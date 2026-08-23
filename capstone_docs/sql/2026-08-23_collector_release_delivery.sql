-- Extends Release Stock to support the Collector ("Middleman") path: a second
-- recipient (the target Sales Rep the collector is delivering to) and a second
-- GPS point (the "Deliver to" destination, pinned on a map, alongside the
-- existing "Deliver from" origin point captured at release time). Direct
-- (Sales Rep) releases are untouched — movement_type stays 'direct', both new
-- columns stay NULL.
--
-- IMPORTANT — run this file in two separate steps, not as one paste:
--   1. Run ONLY the "DROP FUNCTION" statement in step 3 below, by itself, and
--      confirm it succeeds.
--   2. Then run everything else (including the CREATE FUNCTION block).
-- Reason: release_stock_batch's argument list is gaining 3 new params, which
-- changes its Postgres identity. CREATE OR REPLACE cannot retarget a function
-- whose argument types changed — it would silently create a SECOND, overloaded
-- release_stock_batch, and every existing call (which uses named parameters)
-- would immediately start failing with "function is not unique." This is the
-- same class of gotcha as the get_my_agent_accounts fix from 2026-08-19, just
-- triggered by a changed argument list instead of a changed return shape.

-- ============================================================
-- 1. Widen movement_type to allow 'collector' alongside 'direct'.
-- ============================================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_movement_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_movement_type_check
  CHECK (movement_type IN ('direct', 'collector'));

-- ============================================================
-- 2. New nullable columns: the destination GPS point, and the ultimate
--    target recipient (the Sales Rep the Collector is delivering to).
--    received_by keeps its existing meaning — who physically took custody
--    at release time (the Collector, for this path).
-- ============================================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS destination_gps_id uuid REFERENCES public.gps_coordinates(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS target_recipient_id uuid REFERENCES public.user_profiles(id);

-- Invariant: both set together for 'collector', both null for 'direct'. Kept
-- as a real constraint (not just client/RPC discipline) so it holds even if a
-- future write path is added.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_collector_fields_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_collector_fields_check
  CHECK (
    (movement_type = 'direct'    AND destination_gps_id IS NULL     AND target_recipient_id IS NULL)
    OR
    (movement_type = 'collector' AND destination_gps_id IS NOT NULL AND target_recipient_id IS NOT NULL)
  );

-- ============================================================
-- 3. release_stock_batch — DROP the old 9-arg signature first (run this line
--    alone, confirm it succeeds, before continuing).
-- ============================================================
DROP FUNCTION IF EXISTS public.release_stock_batch(
  uuid, uuid, text, double precision, double precision, text, text, text, jsonb
);

-- ---- Run everything below as a second step, after the DROP above succeeded ----

CREATE FUNCTION public.release_stock_batch(
  p_branch_id uuid,
  p_recipient_id uuid,
  p_movement_type text,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_path text,
  p_device_model text,
  p_device_os text,
  p_items jsonb,
  p_target_recipient_id uuid DEFAULT NULL,
  p_destination_latitude double precision DEFAULT NULL,
  p_destination_longitude double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_qr_code text;
  v_gps_id uuid;
  v_destination_gps_id uuid;
  v_media_id uuid;
  v_transaction_id uuid;
  v_item jsonb;
  v_row public.branch_inventory;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Only managers can release stock';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  -- Server-side mirror of the CHECK constraint above (belt-and-suspenders).
  IF p_movement_type = 'collector' AND (
       p_target_recipient_id IS NULL
       OR p_destination_latitude IS NULL
       OR p_destination_longitude IS NULL
     ) THEN
    RAISE EXCEPTION 'Collector releases require a target recipient and a destination GPS point';
  END IF;
  IF p_movement_type = 'direct' AND (
       p_target_recipient_id IS NOT NULL
       OR p_destination_latitude IS NOT NULL
       OR p_destination_longitude IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Direct releases must not include a target recipient or destination GPS point';
  END IF;

  -- Pass 1: lock + validate every line item before writing anything.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_row FROM public.branch_inventory
      WHERE id = (v_item->>'branch_inventory_id')::uuid
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Batch % no longer exists', v_item->>'branch_inventory_id';
    END IF;
    IF v_row.quantity < (v_item->>'quantity')::integer THEN
      RAISE EXCEPTION 'Insufficient stock for %: have %, requested %',
        v_row.product_name, v_row.quantity, v_item->>'quantity';
    END IF;
  END LOOP;

  v_qr_code := encode(gen_random_bytes(12), 'hex');

  INSERT INTO public.gps_coordinates (latitude, longitude, captured_by)
    VALUES (p_latitude, p_longitude, auth.uid()) RETURNING id INTO v_gps_id;

  IF p_destination_latitude IS NOT NULL AND p_destination_longitude IS NOT NULL THEN
    INSERT INTO public.gps_coordinates (latitude, longitude, captured_by)
      VALUES (p_destination_latitude, p_destination_longitude, auth.uid())
      RETURNING id INTO v_destination_gps_id;
  END IF;

  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, auth.uid()) RETURNING id INTO v_media_id;

  INSERT INTO public.transactions
    (branch_id, released_by, received_by, movement_type, qr_code, gps_id,
     destination_gps_id, target_recipient_id, media_id)
    VALUES (p_branch_id, auth.uid(), p_recipient_id, p_movement_type, v_qr_code, v_gps_id,
            v_destination_gps_id, p_target_recipient_id, v_media_id)
    RETURNING id INTO v_transaction_id;

  -- Pass 2: insert details (branch_inventory rows still exist).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_row FROM public.branch_inventory WHERE id = (v_item->>'branch_inventory_id')::uuid;
    INSERT INTO public.transaction_details
      (transaction_id, branch_inventory_id, product_code, product_name, batch_number, mfg_date, exp_date, quantity)
      VALUES (v_transaction_id, v_row.id, v_row.product_code, v_row.product_name,
              v_row.batch_number, v_row.mfg_date, v_row.exp_date, (v_item->>'quantity')::integer);
  END LOOP;

  -- Pass 3: mutate branch_inventory last (always UPDATE, never DELETE).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.branch_inventory
      SET quantity = quantity - (v_item->>'quantity')::integer
      WHERE id = (v_item->>'branch_inventory_id')::uuid;
  END LOOP;

  RETURN jsonb_build_object('qrCode', v_qr_code, 'transactionId', v_transaction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_stock_batch(
  uuid, uuid, text, double precision, double precision, text, text, text, jsonb,
  uuid, double precision, double precision
) TO authenticated;

-- ============================================================
-- 4. RLS — widen the branch-scoped gps_coordinates policy to also match
--    destination_gps_id (the owner-scoped policy, captured_by = auth.uid(),
--    already covers a manager reading their own destination point with zero
--    changes needed).
-- ============================================================
DROP POLICY IF EXISTS "Managers can view gps for their branches' release transactions" ON public.gps_coordinates;

CREATE POLICY "Managers can view gps for their branches' release transactions"
  ON public.gps_coordinates FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT gps_id FROM public.transactions
      WHERE gps_id IS NOT NULL
        AND branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
    )
    OR id IN (
      SELECT destination_gps_id FROM public.transactions
      WHERE destination_gps_id IS NOT NULL
        AND branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
    )
  );

-- Fixes a real data-loss bug: release_stock_batch was deleting
-- branch_inventory rows once fully depleted (to satisfy the old
-- CHECK (quantity > 0)). But receiving_batches' item history is displayed
-- by live-querying branch_inventory through the FK embed — so a fully
-- released batch retroactively showed 0 items/units in the receiving log,
-- since the rows it depended on no longer existed. A log must be an
-- immutable record of what happened, not a live view of current stock.
--
-- Fix: relax the CHECK to allow 0 (never delete, always update down to
-- 0 instead), and add a `received_quantity` column that's set once at
-- insert time and never touched again — this is what "how much did this
-- batch originally have" should read from, independent of how much has
-- since been released.
--
-- Run in Supabase SQL editor, top to bottom.

-- ============================================================
-- 1. Relax the quantity constraint (0 is now a valid, meaningful state —
--    "this batch existed and is now fully released," not "delete it").
-- ============================================================
ALTER TABLE public.branch_inventory DROP CONSTRAINT IF EXISTS branch_inventory_quantity_check;
ALTER TABLE public.branch_inventory ADD CONSTRAINT branch_inventory_quantity_check CHECK (quantity >= 0);

-- ============================================================
-- 2. received_quantity — immutable snapshot of the original amount,
--    populated by a trigger so receive_stock_batch (whose source we don't
--    have to edit) doesn't need to know this column exists at all.
-- ============================================================
ALTER TABLE public.branch_inventory ADD COLUMN IF NOT EXISTS received_quantity integer;

-- Backfill existing rows (their current quantity IS their received
-- quantity — nothing has been released against them via this new feature
-- until now).
UPDATE public.branch_inventory SET received_quantity = quantity WHERE received_quantity IS NULL;

ALTER TABLE public.branch_inventory ALTER COLUMN received_quantity SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_received_quantity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.received_quantity := NEW.quantity;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_received_quantity ON public.branch_inventory;
CREATE TRIGGER trg_set_received_quantity
  BEFORE INSERT ON public.branch_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_received_quantity();

-- ============================================================
-- 3. release_stock_batch — pass 3 now always UPDATEs, never DELETEs.
--    Everything else (validation, statement order, pass 1/2) is unchanged
--    from the version already live.
-- ============================================================
CREATE OR REPLACE FUNCTION public.release_stock_batch(
  p_branch_id uuid,
  p_recipient_id uuid,
  p_movement_type text,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_path text,
  p_device_model text,
  p_device_os text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_qr_code text;
  v_gps_id uuid;
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
  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, auth.uid()) RETURNING id INTO v_media_id;

  INSERT INTO public.transactions
    (branch_id, released_by, received_by, movement_type, qr_code, gps_id, media_id)
    VALUES (p_branch_id, auth.uid(), p_recipient_id, p_movement_type, v_qr_code, v_gps_id, v_media_id)
    RETURNING id INTO v_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_row FROM public.branch_inventory WHERE id = (v_item->>'branch_inventory_id')::uuid;
    INSERT INTO public.transaction_details
      (transaction_id, branch_inventory_id, product_code, product_name, batch_number, mfg_date, exp_date, quantity)
      VALUES (v_transaction_id, v_row.id, v_row.product_code, v_row.product_name,
              v_row.batch_number, v_row.mfg_date, v_row.exp_date, (v_item->>'quantity')::integer);
  END LOOP;

  -- Always UPDATE, never DELETE — a depleted batch (quantity = 0) is a
  -- meaningful, permanent historical fact, not something to erase.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.branch_inventory
      SET quantity = quantity - (v_item->>'quantity')::integer
      WHERE id = (v_item->>'branch_inventory_id')::uuid;
  END LOOP;

  RETURN jsonb_build_object('qrCode', v_qr_code, 'transactionId', v_transaction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_stock_batch(uuid, uuid, text, double precision, double precision, text, text, text, jsonb) TO authenticated;

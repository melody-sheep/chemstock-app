-- Manager Release Stock: transactions/transaction_details tables + RLS + RPC.
-- Run in Supabase SQL editor, top to bottom, as one script.
--
-- Follows the capstone proposal's transaction_table/transaction_details_table
-- design (adapted to this app's established "no _table suffix" naming, same
-- as branches/branch_inventory/receiving_batches).

-- ============================================================
-- 1. Tables
-- ============================================================
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  released_by uuid NOT NULL REFERENCES public.user_profiles(id),
  received_by uuid NOT NULL REFERENCES public.user_profiles(id),
  movement_type text NOT NULL CHECK (movement_type IN ('direct')),
  qr_code text NOT NULL UNIQUE,
  gps_id uuid REFERENCES public.gps_coordinates(id),
  media_id uuid REFERENCES public.media(id),
  remarks text,
  sync_status text NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.transactions (branch_id);
CREATE INDEX ON public.transactions (received_by);
CREATE INDEX ON public.transactions (created_at DESC);

-- branch_inventory_id is nullable + ON DELETE SET NULL, and the product
-- fields are denormalized (not just a reference), because a fully-depleted
-- branch_inventory row must be DELETEd (its CHECK (quantity > 0) forbids
-- updating to 0 — this also keeps the Stocks screen's "no row = out of
-- stock" logic correct with zero changes there). A plain NOT NULL REFERENCES
-- can't survive that delete happening in the same transaction as this
-- insert. Denormalizing means the log line stays self-describing forever
-- regardless of what happens to the source batch.
CREATE TABLE public.transaction_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  branch_inventory_id uuid REFERENCES public.branch_inventory(id) ON DELETE SET NULL,
  product_code text NOT NULL,
  product_name text NOT NULL,
  batch_number text,
  mfg_date date,
  exp_date date,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.transaction_details (transaction_id);
CREATE INDEX ON public.transaction_details (branch_inventory_id);

-- ============================================================
-- 2. RLS — mirrors the exact dual-policy pattern already live for
--    branch_inventory/receiving_batches (owner-scoped + additive
--    branch-scoped). No client INSERT/UPDATE/DELETE policies — all writes
--    go through release_stock_batch() below.
-- ============================================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view their own release transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (released_by = auth.uid());

CREATE POLICY "Managers can view release transactions for their branches"
  ON public.transactions FOR SELECT TO authenticated
  USING (branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Managers can view their own transaction details"
  ON public.transaction_details FOR SELECT TO authenticated
  USING (transaction_id IN (SELECT id FROM public.transactions WHERE released_by = auth.uid()));

CREATE POLICY "Managers can view transaction details for their branches"
  ON public.transaction_details FOR SELECT TO authenticated
  USING (transaction_id IN (
    SELECT id FROM public.transactions
    WHERE branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

-- release_stock_batch() below writes new rows into the EXISTING
-- gps_coordinates/media tables, but their current branch-scoped policies
-- (2026-08-18_branch_wide_stock_visibility.sql) only join through
-- receiving_batches. Add matching additive policies joining through
-- transactions instead, so a release's GPS/photo is visible to any manager
-- of that branch, not just the one who released it.
CREATE POLICY "Managers can view gps for their branches' release transactions"
  ON public.gps_coordinates FOR SELECT TO authenticated
  USING (id IN (
    SELECT gps_id FROM public.transactions
    WHERE gps_id IS NOT NULL
      AND branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Managers can view media for their branches' release transactions"
  ON public.media FOR SELECT TO authenticated
  USING (id IN (
    SELECT media_id FROM public.transactions
    WHERE media_id IS NOT NULL
      AND branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Managers can view release media for their branches"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'shipment-media'
    AND name IN (
      SELECT m.storage_path FROM public.media m
      JOIN public.transactions t ON t.media_id = m.id
      WHERE t.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
    )
  );

-- ============================================================
-- 3. release_stock_batch() — SECURITY DEFINER, mirrors receive_stock_batch's
--    external shape (branch/gps/device/photo-path/items in, {qrCode} out).
--
--    STATEMENT ORDER MATTERS: validate+lock everything first (pass 1),
--    insert transactions + transaction_details while every
--    branch_inventory_id still exists (pass 2 — satisfies the FK), and only
--    THEN mutate branch_inventory last (pass 3), so ON DELETE SET NULL
--    fires correctly against rows already referenced by the details insert.
--    Doing the branch_inventory mutation before the details insert breaks
--    this — don't reorder it "to reserve stock first."
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
  p_items jsonb  -- [{branch_inventory_id, product_code, product_name, quantity}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
-- extensions: gen_random_bytes() is pgcrypto, which lives in the
-- extensions schema on Supabase, not public — same gotcha the team hit
-- before with crypt()/gen_salt() in create_agent_account(). Omitting this
-- fails with "function gen_random_bytes(integer) does not exist" even
-- though the extension is installed.
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
  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, auth.uid()) RETURNING id INTO v_media_id;

  INSERT INTO public.transactions
    (branch_id, released_by, received_by, movement_type, qr_code, gps_id, media_id)
    VALUES (p_branch_id, auth.uid(), p_recipient_id, p_movement_type, v_qr_code, v_gps_id, v_media_id)
    RETURNING id INTO v_transaction_id;

  -- Pass 2: insert details (branch_inventory rows still exist) ...
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_row FROM public.branch_inventory WHERE id = (v_item->>'branch_inventory_id')::uuid;
    INSERT INTO public.transaction_details
      (transaction_id, branch_inventory_id, product_code, product_name, batch_number, mfg_date, exp_date, quantity)
      VALUES (v_transaction_id, v_row.id, v_row.product_code, v_row.product_name,
              v_row.batch_number, v_row.mfg_date, v_row.exp_date, (v_item->>'quantity')::integer);
  END LOOP;

  -- Pass 3: ... then mutate branch_inventory last.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_row FROM public.branch_inventory WHERE id = (v_item->>'branch_inventory_id')::uuid;
    IF v_row.quantity = (v_item->>'quantity')::integer THEN
      DELETE FROM public.branch_inventory WHERE id = v_row.id;
    ELSE
      UPDATE public.branch_inventory SET quantity = quantity - (v_item->>'quantity')::integer WHERE id = v_row.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('qrCode', v_qr_code, 'transactionId', v_transaction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_stock_batch(uuid, uuid, text, double precision, double precision, text, text, text, jsonb) TO authenticated;

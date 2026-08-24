-- Sales Rep (and Collector) "Receive Stock": scanning the release QR a
-- manager generated, confirming receipt with a mandatory photo, and logging
-- the result into the agent's own stock ledger (sr_inventory) — separate
-- from branch_inventory, which represents the branch warehouse, not what an
-- individual field rep is personally carrying.
--
-- Sales Reps/Collectors are NOT Supabase-Auth-backed (plain user_profiles
-- rows, verified once via verify_agent_login, session persisted client-side
-- in AsyncStorage) — their Supabase client is permanently `anon`, so
-- auth.uid() is always NULL for every call they make. Every RLS policy in
-- this app so far is `TO authenticated` keyed on auth.uid(), so an agent's
-- client reading any RLS-protected table directly returns nothing. The four
-- RPCs below are the fix: SECURITY DEFINER, GRANT EXECUTE TO anon, taking
-- the agent's id as an explicit p_agent_id parameter instead of relying on
-- auth.uid() — the same pattern verify_agent_login/create_agent_account
-- already use, just extended to reads/writes and not only login. Each RPC
-- re-verifies p_agent_id is a real sales_rep/collector row before trusting
-- it for anything (same defensive check delete_agent_account already does).

-- ============================================================
-- 1. Tables
-- ============================================================
CREATE TABLE public.stock_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id),
  accepted_by uuid NOT NULL REFERENCES public.user_profiles(id),
  gps_id uuid REFERENCES public.gps_coordinates(id),
  media_id uuid REFERENCES public.media(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_acceptances (accepted_by);

CREATE TABLE public.sr_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acceptance_id uuid NOT NULL REFERENCES public.stock_acceptances(id),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  sr_id uuid NOT NULL REFERENCES public.user_profiles(id),
  product_code text NOT NULL,
  product_name text NOT NULL,
  batch_number text,
  mfg_date date,
  exp_date date,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.sr_inventory (sr_id);
CREATE INDEX ON public.sr_inventory (transaction_id);

-- ============================================================
-- 2. RLS — manager-facing SELECT only. Agents never touch these tables
--    directly, only through the RPCs below.
-- ============================================================
ALTER TABLE public.stock_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sr_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view stock acceptances for their branches"
  ON public.stock_acceptances FOR SELECT TO authenticated
  USING (transaction_id IN (
    SELECT id FROM public.transactions
    WHERE branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Managers can view sr inventory for their branches"
  ON public.sr_inventory FOR SELECT TO authenticated
  USING (transaction_id IN (
    SELECT id FROM public.transactions
    WHERE branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

-- Acceptance-side GPS/photo need their own manager-visibility policies, same
-- reason the release flow already has an equivalent: the owner-scoped
-- policy (captured_by = auth.uid()) never matches — captured_by here is an
-- agent's id, which is never any manager's auth.uid().
CREATE POLICY "Managers can view gps for their branches' stock acceptances"
  ON public.gps_coordinates FOR SELECT TO authenticated
  USING (id IN (
    SELECT sa.gps_id FROM public.stock_acceptances sa
    JOIN public.transactions t ON t.id = sa.transaction_id
    WHERE sa.gps_id IS NOT NULL
      AND t.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Managers can view media for their branches' stock acceptances"
  ON public.media FOR SELECT TO authenticated
  USING (id IN (
    SELECT sa.media_id FROM public.stock_acceptances sa
    JOIN public.transactions t ON t.id = sa.transaction_id
    WHERE sa.media_id IS NOT NULL
      AND t.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Managers can view stock acceptance media for their branches"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shipment-media' AND name IN (
    SELECT m.storage_path FROM public.media m
    JOIN public.stock_acceptances sa ON sa.media_id = m.id
    JOIN public.transactions t ON t.id = sa.transaction_id
    WHERE t.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

-- Agents are always `anon` — the existing per-manager-folder upload policy
-- on shipment-media (keyed on auth.uid()) can never match them. A distinct
-- path prefix keeps this from colliding with manager folders.
CREATE POLICY "Agents can upload their own stock acceptance photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'shipment-media' AND (storage.foldername(name))[1] = 'sr-acceptances');

-- Also let agents read back photos under this same prefix (so the Sales
-- Rep Logs screen can show the photo they just took) — scoped to the
-- sr-acceptances/ prefix only, same breadth as the INSERT policy above, not
-- a new class of exposure beyond what that policy already accepted.
CREATE POLICY "Agents can view their own stock acceptance photos"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'shipment-media' AND (storage.foldername(name))[1] = 'sr-acceptances');

-- ============================================================
-- 3. get_transaction_by_qr_code_for_agent
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_transaction_by_qr_code_for_agent(
  p_qr_code text,
  p_agent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_agent_id AND role IN ('sales_rep', 'collector')
  ) THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  SELECT jsonb_build_object(
    'transactionId', t.id,
    'branchId', t.branch_id,
    'qrCode', t.qr_code,
    'movementType', t.movement_type,
    'receivedBy', t.received_by,
    'receivedByName', rcv.full_name,
    'targetRecipientId', t.target_recipient_id,
    'targetRecipientName', tgt.full_name,
    'releasedByName', rel.full_name,
    'branchName', br.name,
    'alreadyAccepted', EXISTS (
      SELECT 1 FROM public.stock_acceptances sa WHERE sa.transaction_id = t.id
    ),
    'items', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'productCode', td.product_code, 'productName', td.product_name,
          'batchNumber', td.batch_number, 'quantity', td.quantity,
          'mfgDate', td.mfg_date, 'expDate', td.exp_date
        ) ORDER BY td.created_at)
       FROM public.transaction_details td WHERE td.transaction_id = t.id),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.transactions t
  JOIN public.branches br ON br.id = t.branch_id
  LEFT JOIN public.user_profiles rcv ON rcv.id = t.received_by
  LEFT JOIN public.user_profiles tgt ON tgt.id = t.target_recipient_id
  LEFT JOIN public.user_profiles rel ON rel.id = t.released_by
  WHERE t.qr_code = p_qr_code
    AND (t.received_by = p_agent_id OR t.target_recipient_id = p_agent_id);

  IF v_result IS NULL THEN
    -- Same message whether the QR doesn't exist or just isn't this agent's.
    RAISE EXCEPTION 'Transaction not found or not assigned to you';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_transaction_by_qr_code_for_agent(text, uuid) TO anon;

-- ============================================================
-- 4. accept_stock_release
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_stock_release(
  p_qr_code text,
  p_agent_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_path text,
  p_device_model text,
  p_device_os text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn public.transactions;
  v_detail public.transaction_details;
  v_gps_id uuid;
  v_media_id uuid;
  v_acceptance_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_agent_id AND role IN ('sales_rep', 'collector')
  ) THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  -- Lock the transaction row: a concurrent accept for the SAME transaction
  -- (double-tap, two devices, same QR) blocks here instead of racing past
  -- the already-accepted check below. UNIQUE(transaction_id) on
  -- stock_acceptances stays as a hard backstop, not the primary mechanism —
  -- deliberately NOT using ON CONFLICT DO NOTHING, which would let a losing
  -- concurrent call silently continue into the sr_inventory insert loop
  -- below and double-credit the ledger instead of erroring.
  SELECT * INTO v_txn FROM public.transactions WHERE qr_code = p_qr_code FOR UPDATE;

  IF NOT FOUND OR NOT (v_txn.received_by = p_agent_id OR v_txn.target_recipient_id = p_agent_id) THEN
    RAISE EXCEPTION 'Transaction not found or not assigned to you';
  END IF;

  IF EXISTS (SELECT 1 FROM public.stock_acceptances WHERE transaction_id = v_txn.id) THEN
    RAISE EXCEPTION 'This stock has already been accepted';
  END IF;

  -- Only now, after every validation passed, does any INSERT happen — no
  -- orphaned gps_coordinates/media rows for a rejected attempt.
  INSERT INTO public.gps_coordinates (latitude, longitude, captured_by)
    VALUES (p_latitude, p_longitude, p_agent_id) RETURNING id INTO v_gps_id;
  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, p_agent_id) RETURNING id INTO v_media_id;

  INSERT INTO public.stock_acceptances (transaction_id, accepted_by, gps_id, media_id)
    VALUES (v_txn.id, p_agent_id, v_gps_id, v_media_id)
    RETURNING id INTO v_acceptance_id;

  FOR v_detail IN SELECT * FROM public.transaction_details WHERE transaction_id = v_txn.id
  LOOP
    INSERT INTO public.sr_inventory
      (acceptance_id, transaction_id, sr_id, product_code, product_name, batch_number, mfg_date, exp_date, quantity)
      VALUES (v_acceptance_id, v_txn.id, p_agent_id, v_detail.product_code, v_detail.product_name,
              v_detail.batch_number, v_detail.mfg_date, v_detail.exp_date, v_detail.quantity);
  END LOOP;

  RETURN jsonb_build_object('acceptanceId', v_acceptance_id, 'transactionId', v_txn.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_stock_release(text, uuid, double precision, double precision, text, text, text) TO anon;

-- ============================================================
-- 5. get_sr_inventory
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sr_inventory(p_agent_id uuid)
RETURNS SETOF public.sr_inventory
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.sr_inventory WHERE sr_id = p_agent_id ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_sr_inventory(uuid) TO anon;

-- ============================================================
-- 6. get_sr_activity_logs
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sr_activity_logs(p_agent_id uuid, p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_key DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'acceptanceId', sa.id,
      'transactionId', t.id,
      'qrCode', t.qr_code,
      'movementType', t.movement_type,
      'createdAt', sa.created_at,
      'releasedByName', rel.full_name,
      'branchName', br.name,
      'gps', CASE WHEN g.id IS NOT NULL
        THEN jsonb_build_object('latitude', g.latitude, 'longitude', g.longitude)
        ELSE NULL END,
      'media', CASE WHEN m.id IS NOT NULL
        THEN jsonb_build_object('storagePath', m.storage_path, 'deviceModel', m.device_model, 'deviceOs', m.device_os)
        ELSE NULL END,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'productCode', td.product_code, 'productName', td.product_name,
          'batchNumber', td.batch_number, 'quantity', td.quantity,
          'mfgDate', td.mfg_date, 'expDate', td.exp_date
        ) ORDER BY td.created_at)
        FROM public.transaction_details td WHERE td.transaction_id = t.id
      ), '[]'::jsonb)
    ) AS row_data,
    sa.created_at AS sort_key
    FROM public.stock_acceptances sa
    JOIN public.transactions t ON t.id = sa.transaction_id
    JOIN public.branches br ON br.id = t.branch_id
    LEFT JOIN public.user_profiles rel ON rel.id = t.released_by
    LEFT JOIN public.gps_coordinates g ON g.id = sa.gps_id
    LEFT JOIN public.media m ON m.id = sa.media_id
    WHERE sa.accepted_by = p_agent_id
    ORDER BY sa.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sr_activity_logs(uuid, integer) TO anon;

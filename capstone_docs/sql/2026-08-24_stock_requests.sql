-- Sales Rep "Request Stock": a rep requests products from their branch's
-- manager(s); a manager Declines or Accepts (Accept hands off into the
-- existing Release Stock flow, pre-filled); once that release completes,
-- the request is linked back to it for traceability.
--
-- No literal schema for this in the proposal (same situation as
-- SR_inventory_table/deliv_checkpoints_table before it — prose/figures
-- only), so this shape is new, following the app's existing naming
-- convention. Sales Reps are always `anon` (no Supabase Auth session — see
-- every prior agent-facing migration), so submit_stock_request and
-- get_my_stock_requests follow the same SECURITY DEFINER + GRANT TO anon +
-- explicit p_agent_id pattern as verify_agent_login/accept_stock_release/etc.
-- Manager-side RPCs use real auth.uid() like every other manager RPC.

-- ============================================================
-- 1. Tables
-- ============================================================
CREATE TABLE public.stock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  requested_by uuid NOT NULL REFERENCES public.user_profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  device_model text,
  device_os text,
  latitude double precision,
  longitude double precision,
  resolved_by uuid REFERENCES public.user_profiles(id),
  resolved_at timestamptz,
  decline_reason text,
  fulfilled_transaction_id uuid REFERENCES public.transactions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_requests (branch_id);
CREATE INDEX ON public.stock_requests (requested_by);

-- fulfilled_transaction_id can only be set once a request is accepted, and
-- can only ever point at one request (mirrors stock_acceptances.transaction_id
-- UNIQUE — NULLs don't collide, so this is a no-op for pending/declined rows).
ALTER TABLE public.stock_requests ADD CONSTRAINT stock_requests_fulfillment_status_check
  CHECK (fulfilled_transaction_id IS NULL OR status = 'accepted');
ALTER TABLE public.stock_requests ADD CONSTRAINT stock_requests_fulfilled_transaction_id_key
  UNIQUE (fulfilled_transaction_id);

CREATE TABLE public.stock_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.stock_requests(id),
  product_code text NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_request_items (request_id);

-- ============================================================
-- 2. RLS — manager-facing SELECT only. Agents read their own requests
--    through get_my_stock_requests below, not a direct table read.
-- ============================================================
ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view requests for their branches"
  ON public.stock_requests FOR SELECT TO authenticated
  USING (branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Managers can view request items for their branches"
  ON public.stock_request_items FOR SELECT TO authenticated
  USING (request_id IN (
    SELECT id FROM public.stock_requests
    WHERE branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

-- ============================================================
-- 3. submit_stock_request — agent-facing
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_stock_request(
  p_agent_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_device_model text,
  p_device_os text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_ids uuid[];
  v_branch_id uuid;
  v_request_id uuid;
  v_item jsonb;
BEGIN
  SELECT branch_ids INTO v_branch_ids
  FROM public.user_profiles
  WHERE id = p_agent_id AND role IN ('sales_rep', 'collector');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  IF v_branch_ids IS NULL OR array_length(v_branch_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Your account has no assigned branch — contact your manager before submitting a request';
  END IF;

  -- Should never happen for a field agent, but the column type allows it —
  -- fail loud rather than silently picking branch_ids[1] and mis-routing
  -- the request to a branch the rep may not even be at.
  IF array_length(v_branch_ids, 1) > 1 THEN
    RAISE EXCEPTION 'Your account is assigned to more than one branch — stock requests require a single branch';
  END IF;

  v_branch_id := v_branch_ids[1];

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  INSERT INTO public.stock_requests
    (branch_id, requested_by, latitude, longitude, device_model, device_os)
    VALUES (v_branch_id, p_agent_id, p_latitude, p_longitude, p_device_model, p_device_os)
    RETURNING id INTO v_request_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.stock_request_items (request_id, product_code, product_name, quantity)
      VALUES (v_request_id, v_item->>'product_code', v_item->>'product_name', (v_item->>'quantity')::integer);
  END LOOP;

  RETURN jsonb_build_object('requestId', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_stock_request(uuid, double precision, double precision, text, text, jsonb) TO anon;

-- ============================================================
-- 4. accept_stock_request — manager-facing
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_stock_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.stock_requests;
BEGIN
  -- Lock first: two managers on the same branch both tapping "Prepare" for
  -- the same request must not both succeed — the second one blocks here,
  -- then correctly sees status <> 'pending' once it gets the lock.
  SELECT * INTO v_req FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager' AND v_req.branch_id = ANY(branch_ids)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is no longer pending (current status: %)', v_req.status;
  END IF;

  UPDATE public.stock_requests
    SET status = 'accepted', resolved_by = auth.uid(), resolved_at = now()
    WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_stock_request(uuid) TO authenticated;

-- ============================================================
-- 5. decline_stock_request — manager-facing
-- ============================================================
CREATE OR REPLACE FUNCTION public.decline_stock_request(p_request_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.stock_requests;
BEGIN
  SELECT * INTO v_req FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager' AND v_req.branch_id = ANY(branch_ids)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  IF v_req.status = 'declined' THEN
    RAISE EXCEPTION 'Request is already declined';
  END IF;
  IF v_req.fulfilled_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Request has already been fulfilled and cannot be declined';
  END IF;

  -- Declining from 'accepted' is intentionally allowed — the escape hatch
  -- for a request stuck in limbo because a manager tapped Prepare then
  -- backed out of Release Stock without finishing it.
  UPDATE public.stock_requests
    SET status = 'declined', resolved_by = auth.uid(), resolved_at = now(), decline_reason = p_reason
    WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_stock_request(uuid, text) TO authenticated;

-- ============================================================
-- 6. link_request_fulfillment — manager-facing
-- ============================================================
CREATE OR REPLACE FUNCTION public.link_request_fulfillment(p_request_id uuid, p_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.stock_requests;
  v_txn public.transactions;
BEGIN
  SELECT * INTO v_req FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager' AND v_req.branch_id = ANY(branch_ids)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  IF v_req.status <> 'accepted' THEN
    RAISE EXCEPTION 'Request must be accepted before it can be linked to a release (current status: %)', v_req.status;
  END IF;
  IF v_req.fulfilled_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Request is already linked to a release';
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_txn.branch_id <> v_req.branch_id THEN
    RAISE EXCEPTION 'Transaction branch does not match the request''s branch';
  END IF;
  IF v_txn.released_by <> auth.uid() THEN
    RAISE EXCEPTION 'Transaction was not released by you';
  END IF;
  IF v_txn.received_by <> v_req.requested_by THEN
    RAISE EXCEPTION 'Transaction recipient does not match the requesting Sales Rep';
  END IF;

  UPDATE public.stock_requests SET fulfilled_transaction_id = p_transaction_id WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_request_fulfillment(uuid, uuid) TO authenticated;

-- ============================================================
-- 7. get_branch_stock_requests — manager-facing
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_branch_stock_requests(p_limit integer DEFAULT 50)
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
      'requestId', sr.id,
      'status', sr.status,
      'createdAt', sr.created_at,
      'resolvedAt', sr.resolved_at,
      'declineReason', sr.decline_reason,
      'fulfilledTransactionId', sr.fulfilled_transaction_id,
      'requestedById', sr.requested_by,
      'requestedByName', req.full_name,
      'branchId', sr.branch_id,
      'latitude', sr.latitude,
      'longitude', sr.longitude,
      'deviceModel', sr.device_model,
      'deviceOs', sr.device_os,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'productCode', i.product_code, 'productName', i.product_name, 'quantity', i.quantity
        ))
        FROM public.stock_request_items i WHERE i.request_id = sr.id
      ), '[]'::jsonb)
    ) AS row_data,
    sr.created_at AS sort_key
    FROM public.stock_requests sr
    JOIN public.user_profiles req ON req.id = sr.requested_by
    WHERE sr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
    ORDER BY sr.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_branch_stock_requests(integer) TO authenticated;

-- ============================================================
-- 8. get_my_stock_requests — agent-facing
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_stock_requests(p_agent_id uuid, p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role IN ('sales_rep', 'collector')
  ) THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_key DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'requestId', sr.id,
      'status', sr.status,
      'createdAt', sr.created_at,
      'resolvedAt', sr.resolved_at,
      'declineReason', sr.decline_reason,
      'fulfilledTransactionId', sr.fulfilled_transaction_id,
      'latitude', sr.latitude,
      'longitude', sr.longitude,
      'deviceModel', sr.device_model,
      'deviceOs', sr.device_os,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'productCode', i.product_code, 'productName', i.product_name, 'quantity', i.quantity
        ))
        FROM public.stock_request_items i WHERE i.request_id = sr.id
      ), '[]'::jsonb)
    ) AS row_data,
    sr.created_at AS sort_key
    FROM public.stock_requests sr
    WHERE sr.requested_by = p_agent_id
    ORDER BY sr.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_stock_requests(uuid, integer) TO anon;

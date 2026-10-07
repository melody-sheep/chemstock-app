-- 2026-10-08c_submit_stock_request_multi_branch.sql
-- Resolves the TODO's row-29 conflict for real: Clint's device log
-- (Oct 7/8) proves a Sales Rep CAN be multi-branch (branch_ids had both
-- Iponan and Butuan) — so Jay's "a Sales Rep is always single-branch"
-- assumption (§50/§56) was wrong, not just untested. The error seen on
-- device, "Your account is assigned to more than one branch — stock
-- requests require a single branch," is this function's own RAISE
-- EXCEPTION, hit every time for a multi-branch agent.
--
-- Fix: accept an optional p_branch_id, same pattern as the 2026-10-08
-- captured_at migration. RequestListSR.js already collects and shows the
-- chosen branch ("Sending to IPONAN BRANCH") via BranchSelector — it was
-- just never sent to the server. Single-branch agents are unaffected
-- (p_branch_id can stay unset and the old auto-derive path still runs).
--
-- Reconstructed from the exact live body in
-- 2026-10-06c_notifications_system.sql §4 (that file's own comment says
-- "Full body... unchanged except the new block before RETURN," confirming
-- it as the authoritative current version, not 2026-08-24's original).
--
-- Adding a parameter changes the signature — DROP the old 6-arg version
-- first (same reasoning as every other signature change tonight).

DROP FUNCTION IF EXISTS public.submit_stock_request(uuid, double precision, double precision, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.submit_stock_request(
  p_agent_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_device_model text,
  p_device_os text,
  p_items jsonb,
  p_branch_id uuid DEFAULT NULL
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

  IF p_branch_id IS NOT NULL THEN
    -- Ownership check — can't send a request to a branch not on this
    -- agent's own branch_ids, whether by a client bug or tampering.
    IF NOT (p_branch_id = ANY(v_branch_ids)) THEN
      RAISE EXCEPTION 'That branch is not assigned to your account';
    END IF;
    v_branch_id := p_branch_id;
  ELSIF array_length(v_branch_ids, 1) > 1 THEN
    -- No branch given and more than one on file — can't guess. The client
    -- should always send p_branch_id now; this only fires for an old/
    -- un-updated client build.
    RAISE EXCEPTION 'Your account is assigned to more than one branch — pick a branch before sending the request';
  ELSE
    v_branch_id := v_branch_ids[1];
  END IF;

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

  DECLARE
    v_agent_name text;
    v_manager_id uuid;
  BEGIN
    SELECT full_name INTO v_agent_name FROM public.user_profiles WHERE id = p_agent_id;
    FOR v_manager_id IN
      SELECT id FROM public.user_profiles WHERE role = 'manager' AND v_branch_id = ANY(branch_ids)
    LOOP
      PERFORM public._notify(
        v_manager_id, 'stock_request_submitted', 'New stock request',
        COALESCE(v_agent_name, 'A sales rep') || ' requested stock',
        'AgentStockRequest'
      );
    END LOOP;
  END;

  RETURN jsonb_build_object('requestId', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_stock_request(uuid, double precision, double precision, text, text, jsonb, uuid) TO anon;

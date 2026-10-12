-- 2026-10-12b_submit_stock_request_focus_id.sql
-- Corrects 2026-10-12_notification_focus_ids.sql, section 1.
--
-- That file redefined submit_stock_request with the old 6-argument
-- signature. The live function has taken 7 arguments (p_branch_id) since
-- 2026-10-08c, so the 6-argument version was created as a second, unused
-- overload: the app (which always sends p_branch_id) kept calling the real
-- one, and "New stock request" notifications never got their focusId.
--
-- This file: (1) drops the stray 6-argument overload, (2) redefines the real
-- 7-argument function — body copied from 2026-10-08c, unchanged except the
-- _notify call gaining its nav_params argument.

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
        'AgentStockRequest',
        jsonb_build_object('focusId', v_request_id)
      );
    END LOOP;
  END;

  RETURN jsonb_build_object('requestId', v_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_stock_request(uuid, double precision, double precision, text, text, jsonb, uuid) TO anon;

NOTIFY pgrst, 'reload schema';

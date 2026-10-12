-- 2026-10-12_notification_focus_ids.sql
-- Option B, Checkpoint 1 — adds a focusId to the 7 notification types that
-- currently call _notify() with no 5th argument (nav_params defaults to
-- '{}'::jsonb), so the client can jump straight to the relevant row the
-- same way delivery_handoff_* notifications already do (see
-- 2026-10-11_delivery_handoff_confirmation.sql, which set the precedent:
-- jsonb_build_object('transactionId', v_txn.id) as _notify's 5th arg).
--
-- Every function below is CREATE OR REPLACE with its CURRENT live body
-- unchanged except the one _notify(...) call growing a 5th argument. No
-- signature, RLS, grant, or behavior changes. Bodies were re-read from
-- their actual current source files (not the superseded copies) before
-- editing:
--   - submit_stock_request / accept_stock_request / decline_stock_request /
--     request_discrepancy_resolution / accept_discrepancy_resolution /
--     reject_discrepancy_resolution: capstone_docs/sql/2026-10-06c_notifications_system.sql
--   - submit_daily_report: capstone_docs/sql/2026-10-10_submit_daily_report_multi_branch.sql
--     (2026-10-06c has a STALE pre-multi-branch copy of this one — not used)
--   - release_stock_batch: capstone_docs/sql/2026-10-06c_notifications_system.sql
--     is the current version (the only one of its 3 definitions newer than
--     2026-08-21's); NOTE this is the one function Jay's brief lists as
--     off-limits ("No changes to release_stock_batch") — flagged separately,
--     see the chat reply this migration is delivered alongside. Only the
--     notify call's nav_params payload changes here; p_items/stock/GPS/media
--     logic is byte-for-byte identical to the current version.
--
-- focusId values, one per type:
--   stock_request_submitted  -> v_request_id   (stock_requests.id)
--   stock_request_resolved   -> p_request_id   (stock_requests.id, both accept+decline)
--   daily_report_submitted   -> v_report_id    (daily_reports.id)
--   return_request_submitted -> v_resolution_id (discrepancy_resolutions.id)
--   return_request_resolved  -> p_request_id   (discrepancy_resolutions.id, both accept+reject)
--   delivery_assigned        -> v_transaction_id (transactions.id)

-- ============================================================
-- 1. submit_stock_request -> notify manager (AgentStockRequest)
-- ============================================================
-- MOVED to 2026-10-12b_submit_stock_request_focus_id.sql.
-- The version that was here used the old 6-argument signature. The live
-- function has had 7 arguments (p_branch_id) since 2026-10-08c, so running
-- it created a second, unused copy instead of updating the real one.

-- ============================================================
-- 2. accept_stock_request / decline_stock_request -> notify the SR (SalesRepStockRequests)
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

  PERFORM public._notify(
    v_req.requested_by, 'stock_request_resolved', 'Stock request accepted',
    'Your stock request was accepted.', 'SalesRepStockRequests',
    jsonb_build_object('focusId', p_request_id)
  );
END;
$$;

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

  UPDATE public.stock_requests
    SET status = 'declined', resolved_by = auth.uid(), resolved_at = now(), decline_reason = p_reason
    WHERE id = p_request_id;

  PERFORM public._notify(
    v_req.requested_by, 'stock_request_resolved', 'Stock request declined',
    CASE WHEN p_reason IS NOT NULL AND btrim(p_reason) <> ''
      THEN 'Your stock request was declined: ' || p_reason
      ELSE 'Your stock request was declined.' END,
    'SalesRepStockRequests',
    jsonb_build_object('focusId', p_request_id)
  );
END;
$$;

-- ============================================================
-- 3. submit_daily_report -> notify manager (ManageReturns)
--    Current body is 2026-10-10_submit_daily_report_multi_branch.sql's,
--    NOT the stale pre-multi-branch copy in 2026-10-06c.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_daily_report(
  p_agent_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_device_model text,
  p_device_os text,
  p_storage_path text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
  v_report_id uuid;
  v_media_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'sales_rep') THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  v_branch_id := public._sr_primary_branch(p_agent_id);
  IF v_branch_id IS NULL THEN
    SELECT branch_ids[1] INTO v_branch_id FROM public.user_profiles
      WHERE id = p_agent_id AND branch_ids IS NOT NULL AND array_length(branch_ids, 1) IS NOT NULL;
  END IF;
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Your account has no assigned branch — contact your manager before submitting a report';
  END IF;

  IF p_storage_path IS NULL OR length(trim(p_storage_path)) = 0 THEN
    RAISE EXCEPTION 'A handover photo is required to submit your daily report';
  END IF;

  PERFORM public._file_overdue_sr_reports(p_agent_id);

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one product line is required';
  END IF;

  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, p_agent_id)
    RETURNING id INTO v_media_id;

  v_report_id := public._build_daily_report(
    p_agent_id, v_branch_id, public._sr_business_date(), false, p_items,
    p_latitude, p_longitude, p_device_model, p_device_os
  );

  UPDATE public.daily_reports SET media_id = v_media_id WHERE id = v_report_id;

  DECLARE
    v_agent_name text;
    v_manager_id uuid;
  BEGIN
    SELECT full_name INTO v_agent_name FROM public.user_profiles WHERE id = p_agent_id;
    FOR v_manager_id IN
      SELECT id FROM public.user_profiles WHERE role = 'manager' AND v_branch_id = ANY(branch_ids)
    LOOP
      PERFORM public._notify(
        v_manager_id, 'daily_report_submitted', 'Daily report submitted',
        COALESCE(v_agent_name, 'A sales rep') || ' submitted today''s report',
        'ManageReturns',
        jsonb_build_object('focusId', v_report_id)
      );
    END LOOP;
  END;

  RETURN jsonb_build_object('reportId', v_report_id);
END;
$$;

-- ============================================================
-- 4. request_discrepancy_resolution -> notify manager (ManageReturns)
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_discrepancy_resolution(
  p_agent_id uuid,
  p_report_item_id uuid,
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
  v_item public.daily_report_items;
  v_report public.daily_reports;
  v_gps_id uuid;
  v_media_id uuid;
  v_resolution_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'sales_rep') THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;
  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'A photo is required to request a discrepancy resolution';
  END IF;

  SELECT * INTO v_item FROM public.daily_report_items WHERE id = p_report_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report item not found';
  END IF;

  SELECT * INTO v_report FROM public.daily_reports WHERE id = v_item.report_id;
  IF v_report.agent_id <> p_agent_id THEN
    RAISE EXCEPTION 'This discrepancy does not belong to you';
  END IF;

  IF v_item.resolution_status <> 'open' THEN
    RAISE EXCEPTION 'This item has no open discrepancy to resolve (status: %)', v_item.resolution_status;
  END IF;

  IF EXISTS (SELECT 1 FROM public.discrepancy_resolutions WHERE report_item_id = p_report_item_id AND status = 'pending') THEN
    RAISE EXCEPTION 'A resolution request for this item is already pending manager review';
  END IF;

  INSERT INTO public.gps_coordinates (latitude, longitude, captured_by)
    VALUES (p_latitude, p_longitude, p_agent_id) RETURNING id INTO v_gps_id;
  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, p_agent_id) RETURNING id INTO v_media_id;

  INSERT INTO public.discrepancy_resolutions (report_item_id, agent_id, gps_id, media_id)
    VALUES (p_report_item_id, p_agent_id, v_gps_id, v_media_id)
    RETURNING id INTO v_resolution_id;

  DECLARE
    v_agent_name text;
    v_manager_id uuid;
  BEGIN
    SELECT full_name INTO v_agent_name FROM public.user_profiles WHERE id = p_agent_id;
    FOR v_manager_id IN
      SELECT id FROM public.user_profiles WHERE role = 'manager' AND v_report.branch_id = ANY(branch_ids)
    LOOP
      PERFORM public._notify(
        v_manager_id, 'return_request_submitted', 'Return request submitted',
        COALESCE(v_agent_name, 'A sales rep') || ' requested a return for ' || v_item.product_name,
        'ManageReturns',
        jsonb_build_object('focusId', v_resolution_id)
      );
    END LOOP;
  END;

  RETURN jsonb_build_object('resolutionRequestId', v_resolution_id);
END;
$$;

-- ============================================================
-- 5. accept_discrepancy_resolution / reject_discrepancy_resolution ->
--    notify the SR (ReturnStocksSR)
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_discrepancy_resolution(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_item public.daily_report_items;
  v_report public.daily_reports;
  v_resolution public.discrepancy_resolutions;
  v_loss_qty integer;
  v_alloc RECORD;
  v_credit RECORD;
BEGIN
  SELECT report_item_id INTO v_item_id FROM public.discrepancy_resolutions WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resolution request not found';
  END IF;

  SELECT * INTO v_item FROM public.daily_report_items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_resolution FROM public.discrepancy_resolutions WHERE id = p_request_id FOR UPDATE;
  SELECT * INTO v_report FROM public.daily_reports WHERE id = v_item.report_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager' AND v_report.branch_id = ANY(branch_ids)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  IF v_resolution.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is no longer pending (current status: %)', v_resolution.status;
  END IF;

  v_loss_qty := GREATEST(v_item.in_custody_quantity - v_item.sold_quantity - v_item.return_quantity, 0);

  IF v_loss_qty > 0 THEN
    CREATE TEMP TABLE _resolution_credits (batch_number text PRIMARY KEY, credit_qty integer NOT NULL) ON COMMIT DROP;

    FOR v_alloc IN
      SELECT * FROM public._allocate_report_item_batches(v_item.id, v_item.sold_quantity + v_item.return_quantity, v_loss_qty)
    LOOP
      INSERT INTO _resolution_credits (batch_number, credit_qty) VALUES (v_alloc.batch_number, v_alloc.quantity)
        ON CONFLICT (batch_number) DO UPDATE SET credit_qty = _resolution_credits.credit_qty + EXCLUDED.credit_qty;
    END LOOP;

    FOR v_credit IN SELECT * FROM _resolution_credits ORDER BY batch_number
    LOOP
      PERFORM 1 FROM public.branch_inventory WHERE batch_number = v_credit.batch_number FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch % no longer exists in branch inventory — cannot credit recovered stock', v_credit.batch_number;
      END IF;
      UPDATE public.branch_inventory SET quantity = quantity + v_credit.credit_qty WHERE batch_number = v_credit.batch_number;
    END LOOP;
  END IF;

  UPDATE public.discrepancy_resolutions
    SET status = 'accepted', resolved_by = auth.uid(), resolved_at = now()
    WHERE id = p_request_id;

  UPDATE public.daily_report_items SET resolution_status = 'resolved' WHERE id = v_item.id;

  PERFORM public._notify(
    v_resolution.agent_id, 'return_request_resolved', 'Return request accepted',
    'Your return request for ' || v_item.product_name || ' was accepted.', 'ReturnStocksSR',
    jsonb_build_object('focusId', p_request_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_discrepancy_resolution(p_request_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_item public.daily_report_items;
  v_report public.daily_reports;
  v_resolution public.discrepancy_resolutions;
BEGIN
  SELECT report_item_id INTO v_item_id FROM public.discrepancy_resolutions WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resolution request not found';
  END IF;

  SELECT * INTO v_item FROM public.daily_report_items WHERE id = v_item_id FOR UPDATE;
  SELECT * INTO v_resolution FROM public.discrepancy_resolutions WHERE id = p_request_id FOR UPDATE;
  SELECT * INTO v_report FROM public.daily_reports WHERE id = v_item.report_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager' AND v_report.branch_id = ANY(branch_ids)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  IF v_resolution.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is no longer pending (current status: %)', v_resolution.status;
  END IF;

  UPDATE public.discrepancy_resolutions
    SET status = 'rejected', resolved_by = auth.uid(), resolved_at = now(), reject_reason = p_reason
    WHERE id = p_request_id;

  PERFORM public._notify(
    v_resolution.agent_id, 'return_request_resolved', 'Return request declined',
    CASE WHEN p_reason IS NOT NULL AND btrim(p_reason) <> ''
      THEN 'Your return request for ' || v_item.product_name || ' was declined: ' || p_reason
      ELSE 'Your return request for ' || v_item.product_name || ' was declined.' END,
    'ReturnStocksSR',
    jsonb_build_object('focusId', p_request_id)
  );
END;
$$;

-- ============================================================
-- 6. release_stock_batch -> notify collector (CollectorAcceptDeliveries)
--    Flagged exception to "no changes to release_stock_batch" — see chat
--    reply. Only the notify call's nav_params payload changes; every other
--    line (validation, GPS/media inserts, transaction + detail rows,
--    inventory decrement) is identical to the current live body.
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_row FROM public.branch_inventory WHERE id = (v_item->>'branch_inventory_id')::uuid;
    INSERT INTO public.transaction_details
      (transaction_id, branch_inventory_id, product_code, product_name, batch_number, mfg_date, exp_date, quantity)
      VALUES (v_transaction_id, v_row.id, v_row.product_code, v_row.product_name,
              v_row.batch_number, v_row.mfg_date, v_row.exp_date, (v_item->>'quantity')::integer);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.branch_inventory
      SET quantity = quantity - (v_item->>'quantity')::integer
      WHERE id = (v_item->>'branch_inventory_id')::uuid;
  END LOOP;

  IF p_movement_type = 'collector' THEN
    PERFORM public._notify(
      p_recipient_id, 'delivery_assigned', 'New delivery assigned',
      'A delivery is ready for pickup.', 'CollectorAcceptDeliveries',
      jsonb_build_object('focusId', v_transaction_id)
    );
  END IF;

  RETURN jsonb_build_object('qrCode', v_qr_code, 'transactionId', v_transaction_id);
END;
$$;

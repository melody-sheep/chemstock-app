-- Run in the Supabase SQL editor, top to bottom.
--
-- In-app notification system: a notifications table plus 3 read/write RPCs
-- (get_my_notifications, mark_notification_read, mark_all_notifications_read),
-- and a small _notify() helper called from the end of 10 existing action
-- RPCs so a notification is written atomically in the same transaction as
-- the action that caused it — not a separate client-side step that could be
-- forgotten or fail silently.
--
-- Scope: this is the in-app layer only (badge count + notification list).
-- Real OS push notifications (expo-notifications, a push_tokens table,
-- actual push-send) are a deliberately separate follow-up — see the plan
-- notes from this session. Nothing here requires a dev-client build; it's
-- fully testable in Expo Go today, same as everything else in this app.
--
-- Every existing function below is reproduced in full (CREATE OR REPLACE
-- needs the complete body, not a diff) with the SAME signature it already
-- has — confirmed via a full read of every capstone_docs/sql/*.sql file
-- that ever touched each one, so this is the current, authoritative body
-- in each case, not a stale version. Only one new block is added per
-- function, each wrapped in its own nested DECLARE/BEGIN/END so no
-- existing variable name is touched.

-- ============================================================
-- 1. Table
-- ============================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.user_profiles(id),
  type text NOT NULL CHECK (type IN (
    'stock_request_submitted', 'stock_request_resolved',
    'daily_report_submitted',
    'return_request_submitted', 'return_request_resolved',
    'delivery_assigned', 'delivery_status_update'
  )),
  title text NOT NULL,
  body text NOT NULL,
  nav_target text,
  nav_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notifications (recipient_id, is_read, created_at DESC);

-- No policies — same as stock_request_items etc. Managers are authenticated
-- and agents are anon, so every access (read, mark-read) goes through a
-- SECURITY DEFINER RPC below, never a direct client table read.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. _notify() helper — not granted to anon/authenticated; only ever
--    called from inside the other SECURITY DEFINER functions below.
-- ============================================================
CREATE OR REPLACE FUNCTION public._notify(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_nav_target text DEFAULT NULL,
  p_nav_params jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_recipient_id IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications (recipient_id, type, title, body, nav_target, nav_params)
    VALUES (p_recipient_id, p_type, p_title, p_body, p_nav_target, COALESCE(p_nav_params, '{}'::jsonb));
END;
$$;

-- ============================================================
-- 3. Read/write RPCs — same optional p_agent_id pattern as touch_presence:
--    NULL resolves to auth.uid() (Manager), agents pass their id explicitly.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_notifications(p_agent_id uuid DEFAULT NULL, p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE(p_agent_id, auth.uid());
  v_notifications jsonb;
  v_unread_count integer;
BEGIN
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('notifications', '[]'::jsonb, 'unreadCount', 0);
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_key DESC), '[]'::jsonb)
  INTO v_notifications
  FROM (
    SELECT jsonb_build_object(
      'id', n.id,
      'type', n.type,
      'title', n.title,
      'body', n.body,
      'navTarget', n.nav_target,
      'navParams', n.nav_params,
      'isRead', n.is_read,
      'createdAt', n.created_at
    ) AS row_data,
    n.created_at AS sort_key
    FROM public.notifications n
    WHERE n.recipient_id = v_id
    ORDER BY n.created_at DESC
    LIMIT p_limit
  ) sub;

  SELECT count(*) INTO v_unread_count FROM public.notifications WHERE recipient_id = v_id AND is_read = false;

  RETURN jsonb_build_object('notifications', v_notifications, 'unreadCount', v_unread_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_notifications(uuid, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid, p_agent_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE(p_agent_id, auth.uid());
BEGIN
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.notifications SET is_read = true WHERE id = p_notification_id AND recipient_id = v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_agent_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE(p_agent_id, auth.uid());
BEGIN
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.notifications SET is_read = true WHERE recipient_id = v_id AND is_read = false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(uuid) TO anon, authenticated;

-- ============================================================
-- 4. Event 1 — stock request submitted -> notify branch Managers
--    Full body from capstone_docs/sql/2026-08-24_stock_requests.sql:75-132,
--    unchanged except the new block before RETURN.
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

GRANT EXECUTE ON FUNCTION public.submit_stock_request(uuid, double precision, double precision, text, text, jsonb) TO anon;

-- ============================================================
-- 5. Event 2 — stock request accepted/declined -> notify the requesting SR
--    Full bodies from capstone_docs/sql/2026-08-24_stock_requests.sql:139-213.
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
    'Your stock request was accepted.', 'SalesRepStockRequests'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_stock_request(uuid) TO authenticated;

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
    'SalesRepStockRequests'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_stock_request(uuid, text) TO authenticated;

-- ============================================================
-- 6. Event 3 — daily report submitted -> notify branch Managers
--    Full body from capstone_docs/sql/2026-10-04_release_branch_photo_discrepancy_branch.sql:57-113
--    (the current, latest version — signature already includes p_storage_path).
--    No v_branch_id scalar exists in the original — v_branch_ids[1] used directly.
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
  v_branch_ids uuid[];
  v_report_id uuid;
  v_media_id uuid;
BEGIN
  SELECT branch_ids INTO v_branch_ids FROM public.user_profiles WHERE id = p_agent_id AND role = 'sales_rep';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;
  IF v_branch_ids IS NULL OR array_length(v_branch_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Your account has no assigned branch — contact your manager before submitting a report';
  END IF;
  IF array_length(v_branch_ids, 1) > 1 THEN
    RAISE EXCEPTION 'Your account is assigned to more than one branch — daily reports require a single branch';
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
    p_agent_id, v_branch_ids[1], public._sr_business_date(), false, p_items,
    p_latitude, p_longitude, p_device_model, p_device_os
  );

  UPDATE public.daily_reports SET media_id = v_media_id WHERE id = v_report_id;

  DECLARE
    v_agent_name text;
    v_manager_id uuid;
  BEGIN
    SELECT full_name INTO v_agent_name FROM public.user_profiles WHERE id = p_agent_id;
    FOR v_manager_id IN
      SELECT id FROM public.user_profiles WHERE role = 'manager' AND v_branch_ids[1] = ANY(branch_ids)
    LOOP
      PERFORM public._notify(
        v_manager_id, 'daily_report_submitted', 'Daily report submitted',
        COALESCE(v_agent_name, 'A sales rep') || ' submitted today''s report',
        'ManageReturns'
      );
    END LOOP;
  END;

  RETURN jsonb_build_object('reportId', v_report_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_daily_report(uuid, double precision, double precision, text, text, text, jsonb) TO anon;

-- ============================================================
-- 7. Event 4 — return/discrepancy request submitted -> notify branch Managers
--    Full body from capstone_docs/sql/2026-08-26_sr_daily_reports_and_returns.sql:537-595.
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
        'ManageReturns'
      );
    END LOOP;
  END;

  RETURN jsonb_build_object('resolutionRequestId', v_resolution_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_discrepancy_resolution(uuid, uuid, double precision, double precision, text, text, text) TO anon;

-- ============================================================
-- 8. Event 5 — return request accepted/rejected -> notify the requesting SR
--    Full bodies from capstone_docs/sql/2026-08-26_sr_daily_reports_and_returns.sql:777-880.
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
    'Your return request for ' || v_item.product_name || ' was accepted.', 'ReturnStocksSR'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_discrepancy_resolution(uuid) TO authenticated;

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
    'ReturnStocksSR'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_discrepancy_resolution(uuid, text) TO authenticated;

-- ============================================================
-- 9. Event 6 — delivery assigned to a Collector -> notify that Collector
--    Full body from capstone_docs/sql/2026-08-23_collector_release_delivery.sql:57-168
--    (the current, latest version — 12-param signature already in place).
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
      'A delivery is ready for pickup.', 'CollectorAcceptDeliveries'
    );
  END IF;

  RETURN jsonb_build_object('qrCode', v_qr_code, 'transactionId', v_transaction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_stock_batch(
  uuid, uuid, text, double precision, double precision, text, text, text, jsonb,
  uuid, double precision, double precision
) TO authenticated;

-- ============================================================
-- 10. Event 7 — delivery status update -> notify the target Sales Rep
--     Full bodies from capstone_docs/sql/2026-08-25_collector_delivery_trips.sql
--     (start_delivery_trip:162-228, finish_delivery_leg:344-409). Neither
--     function previously read target_recipient_id — both now do, purely
--     to notify; no other behavior changes.
--     log_delivery_checkpoint is deliberately NOT touched — it fires once
--     per waypoint per leg, far too often for a per-event notification.
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_delivery_trip(
  p_agent_id uuid,
  p_transaction_ids uuid[],
  p_latitude double precision,
  p_longitude double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
  v_branch_id uuid;
  v_trip_id uuid;
  v_origin_gps_id uuid;
  v_txn public.transactions;
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'collector') THEN
    RAISE EXCEPTION 'Invalid collector';
  END IF;

  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_ids FROM unnest(p_transaction_ids) AS x;
  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one delivery is required to start a trip';
  END IF;

  FOR v_txn IN
    SELECT * FROM public.transactions WHERE id = ANY(v_ids) ORDER BY id FOR UPDATE
  LOOP
    IF v_txn.received_by <> p_agent_id OR v_txn.movement_type <> 'collector' THEN
      RAISE EXCEPTION 'Delivery % is not assigned to you', v_txn.id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.stock_acceptances sa WHERE sa.transaction_id = v_txn.id) THEN
      RAISE EXCEPTION 'Delivery % has not been accepted from the manager yet', v_txn.id;
    END IF;
    IF v_txn.delivery_status <> 'not_delivered' THEN
      RAISE EXCEPTION 'Delivery % is no longer ready to deliver (status: %)', v_txn.id, v_txn.delivery_status;
    END IF;

    IF v_branch_id IS NULL THEN
      v_branch_id := v_txn.branch_id;
    ELSIF v_txn.branch_id <> v_branch_id THEN
      RAISE EXCEPTION 'A single trip cannot mix deliveries from different branches';
    END IF;
  END LOOP;

  INSERT INTO public.gps_coordinates (latitude, longitude, captured_by)
    VALUES (p_latitude, p_longitude, p_agent_id) RETURNING id INTO v_origin_gps_id;

  INSERT INTO public.delivery_trips (collector_id, branch_id, origin_gps_id)
    VALUES (p_agent_id, v_branch_id, v_origin_gps_id) RETURNING id INTO v_trip_id;

  FOREACH v_id IN ARRAY v_ids LOOP
    INSERT INTO public.delivery_trip_items (trip_id, transaction_id) VALUES (v_trip_id, v_id);
  END LOOP;

  UPDATE public.transactions SET delivery_status = 'in_transit' WHERE id = ANY(v_ids);

  DECLARE
    v_notify_txn public.transactions;
  BEGIN
    FOR v_notify_txn IN SELECT * FROM public.transactions WHERE id = ANY(v_ids)
    LOOP
      PERFORM public._notify(
        v_notify_txn.target_recipient_id, 'delivery_status_update', 'Your delivery is on the way',
        'A collector is en route with your delivery.', 'SalesRepDeliveryDetail',
        jsonb_build_object('transactionId', v_notify_txn.id)
      );
    END LOOP;
  END;

  RETURN jsonb_build_object('tripId', v_trip_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_delivery_trip(uuid, uuid[], double precision, double precision) TO anon;

CREATE OR REPLACE FUNCTION public.finish_delivery_leg(
  p_agent_id uuid,
  p_transaction_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip_id uuid;
  v_trip public.delivery_trips;
  v_txn public.transactions;
  v_all_delivered boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'collector') THEN
    RAISE EXCEPTION 'Invalid collector';
  END IF;

  SELECT dti.trip_id INTO v_trip_id
  FROM public.delivery_trip_items dti
  JOIN public.delivery_trips dt ON dt.id = dti.trip_id
  WHERE dti.transaction_id = p_transaction_id AND dt.status = 'active';

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'This delivery is not part of an active trip';
  END IF;

  SELECT * INTO v_trip FROM public.delivery_trips WHERE id = v_trip_id FOR UPDATE;
  IF v_trip.status <> 'active' THEN
    RAISE EXCEPTION 'Trip is no longer active';
  END IF;
  IF v_trip.collector_id <> p_agent_id THEN
    RAISE EXCEPTION 'Not your trip';
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF v_txn.received_by <> p_agent_id OR v_txn.delivery_status <> 'in_transit' THEN
    RAISE EXCEPTION 'This delivery is not an active leg for you';
  END IF;

  UPDATE public.transactions
    SET delivery_status = 'delivered', delivered_at = now()
    WHERE id = p_transaction_id;

  INSERT INTO public.delivery_checkpoints (transaction_id, latitude, longitude, label, captured_by)
    VALUES (p_transaction_id, p_latitude, p_longitude, COALESCE(p_label, 'Delivered'), p_agent_id);

  SELECT NOT EXISTS (
    SELECT 1 FROM public.delivery_trip_items dti
    JOIN public.transactions t ON t.id = dti.transaction_id
    WHERE dti.trip_id = v_trip.id AND t.delivery_status <> 'delivered'
  ) INTO v_all_delivered;

  IF v_all_delivered THEN
    UPDATE public.delivery_trips SET status = 'completed', completed_at = now() WHERE id = v_trip.id;
  END IF;

  PERFORM public._notify(
    v_txn.target_recipient_id, 'delivery_status_update', 'Delivery completed',
    'Your delivery has arrived.', 'SalesRepDeliveryDetail',
    jsonb_build_object('transactionId', v_txn.id)
  );

  RETURN jsonb_build_object('tripCompleted', v_all_delivered);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_delivery_leg(uuid, uuid, double precision, double precision, text) TO anon;

-- Refresh PostgREST so every new/changed function is callable right away.
NOTIFY pgrst, 'reload schema';

-- Run in Supabase SQL editor, top to bottom. Safe to run more than once.
-- To undo: 2026-10-20c_offline_safe_sending_ROLLBACK.sql
--
-- TODO #8 (decision: Alther, Oct 20) — three problems with things saved on a
-- phone while offline and sent hours later:
--
--  P1-4  A reply lost on a weak connection made the phone send the same
--        request again → duplicate stock request / report / return request /
--        checkpoint. Every queued item now carries its own id (client_id);
--        the server remembers it and, on a repeat, returns the first result
--        instead of saving it twice.
--  N2    An offline report is filed under the day the phone SAVED it (today
--        or yesterday only), not the day it reached the server. Missed-day
--        auto-filing stops before that day.
--  N16   A queued "delivered" keeps the time the Collector tapped it, not the
--        sync time. A future time is ignored.
--
-- Nothing live is changed: every existing function stays exactly as it is, so
-- APK 1.0.6 and older keep working untouched. The new "_once" functions sit
-- beside them; the 1.0.7 app calls those (and falls back to the old ones if
-- this file hasn't been run).

-- ============================================================
-- 1. Remembered request ids
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_requests (
  client_id  uuid PRIMARY KEY,
  agent_id   uuid NOT NULL,
  kind       text NOT NULL,
  result     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_requests_created_at_idx ON public.client_requests (created_at);
ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_requests FROM PUBLIC, anon, authenticated;

-- Returns NULL when this is the first time the id is seen (go ahead and do
-- the work), or {"result": <the first result>} for a repeat. Two copies
-- arriving at the same moment: the second waits for the first to finish.
CREATE OR REPLACE FUNCTION public._idem_begin(p_client_id uuid, p_agent_id uuid, p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.client_requests;
BEGIN
  -- Housekeeping: ids older than 30 days can never come back.
  DELETE FROM public.client_requests WHERE created_at < now() - interval '30 days';

  INSERT INTO public.client_requests (client_id, agent_id, kind)
    VALUES (p_client_id, p_agent_id, p_kind)
  ON CONFLICT (client_id) DO NOTHING;

  IF FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row FROM public.client_requests WHERE client_id = p_client_id;
  IF v_row.agent_id <> p_agent_id OR v_row.kind <> p_kind THEN
    RAISE EXCEPTION 'This request id was already used for something else';
  END IF;
  RETURN jsonb_build_object('result', COALESCE(v_row.result, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public._idem_begin(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. Stock request (P1-4)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_stock_request_once(
  p_client_id uuid,
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
  v_dup jsonb;
  v_result jsonb;
BEGIN
  IF p_client_id IS NOT NULL THEN
    v_dup := public._idem_begin(p_client_id, p_agent_id, 'stock_request');
    IF v_dup IS NOT NULL THEN
      RETURN (v_dup->'result') || jsonb_build_object('duplicate', true);
    END IF;
  END IF;

  v_result := public.submit_stock_request(
    p_agent_id, p_latitude, p_longitude, p_device_model, p_device_os, p_items, p_branch_id
  );

  IF p_client_id IS NOT NULL THEN
    UPDATE public.client_requests SET result = v_result WHERE client_id = p_client_id;
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_stock_request_once(uuid, uuid, double precision, double precision, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_stock_request_once(uuid, uuid, double precision, double precision, text, text, jsonb, uuid) TO anon, authenticated;

-- ============================================================
-- 3. Return request (P1-4)
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_discrepancy_resolution_once(
  p_client_id uuid,
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
  v_dup jsonb;
  v_result jsonb;
BEGIN
  IF p_client_id IS NOT NULL THEN
    v_dup := public._idem_begin(p_client_id, p_agent_id, 'discrepancy_resolution');
    IF v_dup IS NOT NULL THEN
      RETURN (v_dup->'result') || jsonb_build_object('duplicate', true);
    END IF;
  END IF;

  v_result := public.request_discrepancy_resolution(
    p_agent_id, p_report_item_id, p_latitude, p_longitude, p_storage_path, p_device_model, p_device_os
  );

  IF p_client_id IS NOT NULL THEN
    UPDATE public.client_requests SET result = v_result WHERE client_id = p_client_id;
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.request_discrepancy_resolution_once(uuid, uuid, uuid, double precision, double precision, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_discrepancy_resolution_once(uuid, uuid, uuid, double precision, double precision, text, text, text) TO anon, authenticated;

-- ============================================================
-- 4. Delivery checkpoint (P1-4; captured_at already existed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_delivery_checkpoint_once(
  p_client_id uuid,
  p_agent_id uuid,
  p_trip_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_label text,
  p_captured_at timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dup jsonb;
  v_result jsonb;
BEGIN
  IF p_client_id IS NOT NULL THEN
    v_dup := public._idem_begin(p_client_id, p_agent_id, 'delivery_checkpoint');
    IF v_dup IS NOT NULL THEN
      RETURN (v_dup->'result') || jsonb_build_object('duplicate', true);
    END IF;
  END IF;

  v_result := public.log_delivery_checkpoint(
    p_agent_id, p_trip_id, p_latitude, p_longitude, p_label, p_captured_at
  );

  IF p_client_id IS NOT NULL THEN
    UPDATE public.client_requests SET result = v_result WHERE client_id = p_client_id;
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.log_delivery_checkpoint_once(uuid, uuid, uuid, double precision, double precision, text, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_delivery_checkpoint_once(uuid, uuid, uuid, double precision, double precision, text, timestamp with time zone) TO anon, authenticated;

-- ============================================================
-- 5. Mark delivered (P1-4 + N16: keeps the time it was tapped)
-- ============================================================
CREATE OR REPLACE FUNCTION public.finish_delivery_leg_once(
  p_client_id uuid,
  p_agent_id uuid,
  p_transaction_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_label text,
  p_delivered_at timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dup jsonb;
  v_result jsonb;
  -- A time in the future, or more than a week old, is ignored (sync time is used).
  v_at timestamptz := CASE
    WHEN p_delivered_at IS NULL OR p_delivered_at > now() OR p_delivered_at < now() - interval '7 days' THEN NULL
    ELSE p_delivered_at END;
BEGIN
  IF p_client_id IS NOT NULL THEN
    v_dup := public._idem_begin(p_client_id, p_agent_id, 'finish_delivery_leg');
    IF v_dup IS NOT NULL THEN
      RETURN (v_dup->'result') || jsonb_build_object('duplicate', true);
    END IF;
  END IF;

  v_result := public.finish_delivery_leg(p_agent_id, p_transaction_id, p_latitude, p_longitude, p_label);

  IF v_at IS NOT NULL THEN
    UPDATE public.transactions SET delivered_at = v_at WHERE id = p_transaction_id;
    UPDATE public.delivery_handoffs SET collector_claimed_at = v_at
      WHERE transaction_id = p_transaction_id AND handoff_status = 'pending_sr';
    UPDATE public.delivery_checkpoints SET captured_at = v_at
      WHERE id = (
        SELECT id FROM public.delivery_checkpoints
        WHERE transaction_id = p_transaction_id AND captured_by = p_agent_id
        ORDER BY created_at DESC LIMIT 1
      );
    IF COALESCE((v_result->>'tripCompleted')::boolean, false) THEN
      UPDATE public.delivery_trips SET completed_at = v_at
        WHERE id = (SELECT trip_id FROM public.delivery_trip_items WHERE transaction_id = p_transaction_id LIMIT 1);
    END IF;
  END IF;

  IF p_client_id IS NOT NULL THEN
    UPDATE public.client_requests SET result = v_result WHERE client_id = p_client_id;
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_delivery_leg_once(uuid, uuid, uuid, double precision, double precision, text, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_delivery_leg_once(uuid, uuid, uuid, double precision, double precision, text, timestamp with time zone) TO anon, authenticated;

-- ============================================================
-- 6. Daily report (P1-4 + N2)
-- ============================================================
-- Same as _file_overdue_sr_reports (live body from
-- 2026-10-10_submit_daily_report_multi_branch.sql) except it files missed days
-- only BEFORE p_until instead of before today, so the day an offline report
-- belongs to is not auto-filed as missed ahead of it.
CREATE OR REPLACE FUNCTION public._file_overdue_sr_reports_until(p_agent_id uuid, p_until date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_branch_ids uuid[];
  v_branch_id uuid;
  v_cursor_date date;
  v_start_date date;
BEGIN
  SELECT branch_ids INTO v_branch_ids FROM public.user_profiles WHERE id = p_agent_id;
  IF v_branch_ids IS NULL OR array_length(v_branch_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  v_branch_id := public._sr_primary_branch(p_agent_id);
  IF v_branch_id IS NULL THEN
    v_branch_id := v_branch_ids[1];
  END IF;

  SELECT MAX(report_date) + 1 INTO v_start_date FROM public.daily_reports WHERE agent_id = p_agent_id;
  IF v_start_date IS NULL THEN
    SELECT MIN((created_at AT TIME ZONE 'Asia/Manila')::date) INTO v_start_date
      FROM public.sr_inventory WHERE sr_id = p_agent_id;
  END IF;
  IF v_start_date IS NULL THEN
    RETURN;
  END IF;

  v_cursor_date := v_start_date;
  WHILE v_cursor_date < p_until LOOP
    IF EXISTS (
      SELECT 1 FROM public.sr_inventory si
      JOIN public.transactions t ON t.id = si.transaction_id
      WHERE si.sr_id = p_agent_id AND si.remaining_quantity > 0
        AND (si.created_at AT TIME ZONE 'Asia/Manila')::date <= v_cursor_date
        AND t.branch_id = v_branch_id
    ) THEN
      PERFORM public._build_daily_report(p_agent_id, v_branch_id, v_cursor_date, true, NULL, NULL, NULL, NULL, NULL);
    END IF;
    v_cursor_date := v_cursor_date + 1;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public._file_overdue_sr_reports_until(uuid, date) FROM PUBLIC, anon, authenticated;

-- Same as submit_daily_report (live body from 2026-10-12_notification_focus_ids.sql,
-- section 3) plus: p_client_id (no duplicates) and p_report_date (the day the
-- phone saved the report; only today or yesterday are accepted, anything else
-- is filed for today).
CREATE OR REPLACE FUNCTION public.submit_daily_report_once(
  p_client_id uuid,
  p_agent_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_device_model text,
  p_device_os text,
  p_storage_path text,
  p_items jsonb,
  p_report_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dup jsonb;
  v_branch_id uuid;
  v_report_id uuid;
  v_media_id uuid;
  v_today date := public._sr_business_date();
  v_date date;
  v_result jsonb;
BEGIN
  IF p_client_id IS NOT NULL THEN
    v_dup := public._idem_begin(p_client_id, p_agent_id, 'daily_report');
    IF v_dup IS NOT NULL THEN
      RETURN (v_dup->'result') || jsonb_build_object('duplicate', true);
    END IF;
  END IF;

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

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one product line is required';
  END IF;

  -- N2: the day the phone saved it (today or yesterday), else today.
  v_date := CASE
    WHEN p_report_date IS NOT NULL AND p_report_date IN (v_today, v_today - 1) THEN p_report_date
    ELSE v_today END;

  -- Missed days before that day are filed as before; that day itself is not.
  PERFORM public._file_overdue_sr_reports_until(p_agent_id, v_date);

  IF EXISTS (SELECT 1 FROM public.daily_reports WHERE agent_id = p_agent_id AND report_date = v_date) THEN
    RAISE EXCEPTION 'A report for % is already filed', to_char(v_date, 'Mon DD');
  END IF;

  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, p_agent_id)
    RETURNING id INTO v_media_id;

  v_report_id := public._build_daily_report(
    p_agent_id, v_branch_id, v_date, false, p_items,
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
        COALESCE(v_agent_name, 'A sales rep') ||
          CASE WHEN v_date = v_today THEN ' submitted today''s report'
               ELSE ' submitted the report for ' || to_char(v_date, 'Mon DD') END,
        'ManageReturns',
        jsonb_build_object('focusId', v_report_id)
      );
    END LOOP;
  END;

  v_result := jsonb_build_object('reportId', v_report_id);
  IF p_client_id IS NOT NULL THEN
    UPDATE public.client_requests SET result = v_result WHERE client_id = p_client_id;
  END IF;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_daily_report_once(uuid, uuid, double precision, double precision, text, text, text, jsonb, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_daily_report_once(uuid, uuid, double precision, double precision, text, text, text, jsonb, date) TO anon, authenticated;

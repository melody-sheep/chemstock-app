-- Run in Supabase SQL editor, top to bottom.
-- Three independent changes, grouped here because they shipped together:
--   1. daily_reports gains a mandatory handover photo (SubmitReportSR.js).
--   2. submit_daily_report's signature changes (adds p_storage_path) —
--      DROP must run as its own statement before CREATE; CREATE OR REPLACE
--      cannot add a parameter (same lesson as 2026-08-19's migration note
--      in Jay_Sprint1.1.md §13).
--   3. get_branch_discrepancies / get_branch_daily_reports now surface
--      which branch each row belongs to (ManagerAlertsScreen.js,
--      ManageReturnsScreen.js) — both still RETURNS jsonb, so a plain
--      CREATE OR REPLACE is safe for those two, no DROP needed.
--
-- Deliberately NOT included: a fix for multi-branch Sales Reps being
-- blocked from submitting a daily report at all. sr_inventory has no
-- branch_id of its own — tracing custody back to a branch means joining
-- through sr_inventory.transaction_id -> transactions.branch_id, which
-- also touches _allocate_report_item_batches / accept_daily_report /
-- accept_discrepancy_resolution (the credit-back-to-inventory logic).
-- That's a real design question (one combined custody pool vs. genuinely
-- separate per-branch pools), not a safe drop-in — flagged to Jay
-- separately rather than rushed in here.

-- ============================================================
-- 1. daily_reports: mandatory handover photo
-- ============================================================
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS media_id uuid REFERENCES public.media(id);

-- Storage policies for the new sr-daily-reports/ prefix — same 3-tier
-- pattern as every other agent photo type in this app (see
-- 2026-08-23_sr_receive_stock.sql's sr-acceptances/ policies): agents
-- (always `anon`, no Supabase Auth session) get upload + read-own on this
-- prefix; managers get branch-scoped read via a join back through
-- daily_reports.branch_id. No public.media table policy needed here — this
-- feature is read entirely through the SECURITY DEFINER
-- get_branch_daily_reports RPC below, which already bypasses RLS, not a
-- direct client-side embedded select the way some other screens work.
CREATE POLICY "Agents can upload their own daily report photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'shipment-media' AND (storage.foldername(name))[1] = 'sr-daily-reports');

CREATE POLICY "Agents can view their own daily report photos"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'shipment-media' AND (storage.foldername(name))[1] = 'sr-daily-reports');

CREATE POLICY "Managers can view daily report media for their branches"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shipment-media' AND name IN (
    SELECT m.storage_path FROM public.media m
    JOIN public.daily_reports dr ON dr.media_id = m.id
    WHERE dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

-- ============================================================
-- 2. submit_daily_report: require p_storage_path, link it via media_id.
--    Branch logic is UNCHANGED (still single-branch only) — see note above.
-- ============================================================
DROP FUNCTION IF EXISTS public.submit_daily_report(uuid, double precision, double precision, text, text, jsonb);

CREATE FUNCTION public.submit_daily_report(
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

  RETURN jsonb_build_object('reportId', v_report_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_daily_report(uuid, double precision, double precision, text, text, text, jsonb) TO anon;

-- ============================================================
-- 3. get_branch_discrepancies: add branchId/branchName
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_branch_discrepancies(p_limit integer DEFAULT 200)
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
      'reportItemId', dri.id, 'reportId', dr.id, 'reportDate', dr.report_date,
      'agentId', dr.agent_id, 'agentName', ag.full_name,
      'branchId', dr.branch_id, 'branchName', br.name,
      'productCode', dri.product_code, 'productName', dri.product_name,
      'inCustodyQuantity', dri.in_custody_quantity, 'soldQuantity', dri.sold_quantity,
      'returnQuantity', dri.return_quantity, 'discrepancy', dri.discrepancy,
      'discrepancyType', CASE WHEN dri.discrepancy < 0 THEN 'loss' ELSE 'over' END,
      'resolutionStatus', dri.resolution_status,
      'latestRequest', (
        SELECT jsonb_build_object('id', x.id, 'status', x.status, 'createdAt', x.created_at)
        FROM public.discrepancy_resolutions x WHERE x.report_item_id = dri.id
        ORDER BY x.created_at DESC LIMIT 1
      )
    ) AS row_data, dr.report_date AS sort_key
    FROM public.daily_report_items dri
    JOIN public.daily_reports dr ON dr.id = dri.report_id
    JOIN public.user_profiles ag ON ag.id = dr.agent_id
    JOIN public.branches br ON br.id = dr.branch_id
    WHERE dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
      AND dri.discrepancy <> 0
    ORDER BY dr.report_date DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_branch_discrepancies(integer) TO authenticated;

-- ============================================================
-- 4. get_branch_daily_reports: add branchName + the handover photo path
--    (mediaPath is null for auto-filed reports — there was no manual
--    submission, so no photo was ever taken).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_branch_daily_reports(p_limit integer DEFAULT 50)
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
      'reportId', dr.id, 'reportDate', dr.report_date, 'status', dr.status,
      'isAutoFiled', dr.is_auto_filed, 'createdAt', dr.created_at, 'resolvedAt', dr.resolved_at,
      'agentId', dr.agent_id, 'agentName', ag.full_name, 'branchId', dr.branch_id, 'branchName', br.name,
      'mediaPath', m.storage_path,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'reportItemId', dri.id, 'productCode', dri.product_code, 'productName', dri.product_name,
          'inCustodyQuantity', dri.in_custody_quantity, 'soldQuantity', dri.sold_quantity,
          'returnQuantity', dri.return_quantity, 'discrepancy', dri.discrepancy,
          'resolutionStatus', dri.resolution_status
        ) ORDER BY dri.product_code)
        FROM public.daily_report_items dri WHERE dri.report_id = dr.id
      ), '[]'::jsonb)
    ) AS row_data, dr.created_at AS sort_key
    FROM public.daily_reports dr
    JOIN public.user_profiles ag ON ag.id = dr.agent_id
    JOIN public.branches br ON br.id = dr.branch_id
    LEFT JOIN public.media m ON m.id = dr.media_id
    WHERE dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
    ORDER BY dr.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_branch_daily_reports(integer) TO authenticated;

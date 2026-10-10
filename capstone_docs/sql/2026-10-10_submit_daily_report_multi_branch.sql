-- 2026-10-10_submit_daily_report_multi_branch.sql
-- REPLACES this file's own earlier content (never run) — that version asked
-- the Sales Rep to manually pick a branch via a p_branch_id parameter and a
-- chip row in SubmitReportSR.js. Jay's follow-up feedback: don't ask —
-- derive it, the same way the business already does: whichever branch the
-- agent's held stock actually came from (the receiving transaction), not
-- something a human needs to tap. This version does that instead, and
-- removes the UI picker entirely.
--
-- While building this, found the bug actually goes deeper than
-- submit_daily_report's own "more than one branch" RAISE EXCEPTION:
-- get_my_sr_report_status / _build_daily_report / _file_overdue_sr_reports
-- all compute an agent's "in custody" stock from sr_inventory with NO branch
-- filter at all — for a multi-branch agent this silently merges BOTH
-- branches' stock into one number. That's almost certainly also the cause
-- of the separate "SR could enter Sold+Return greater than In Custody" bug
-- reported the same day (device: In Custody 30, Sold 40, Return 20) — once
-- branches are properly separated the figures shown will be correct for
-- the one branch being reported, and a server-side check is added below so
-- this can never be bypassed again regardless of cause.
--
-- Fix, four functions:
--   1. New _sr_primary_branch(agent) — the branch holding the most of the
--      agent's current remaining stock (their only branch, 99% of the time).
--   2. _build_daily_report — every sr_inventory query now joins transactions
--      and filters to p_branch_id, so a report only ever covers ITS branch's
--      stock. Also adds a sold+return <= in_custody server-side check
--      (nothing in the schema enforced this before — daily_report_items only
--      checks each column >= 0 on its own).
--   3. _file_overdue_sr_reports — uses _sr_primary_branch instead of
--      "whichever branch happens to be first in branch_ids", and its own
--      stock-exists check is now branch-scoped to match.
--   4. get_my_sr_report_status / submit_daily_report — both derive the same
--      branch via _sr_primary_branch; get_my_sr_report_status also returns
--      branchId/branchName so the screen can show (read-only) which branch
--      today's report is for.
--
-- _build_daily_report and _file_overdue_sr_reports are internal helpers
-- (no GRANT, unchanged argument lists) — CREATE OR REPLACE is safe, no DROP
-- needed. submit_daily_report's signature is also unchanged from what's
-- currently live (7 args, no p_branch_id — the 8-arg version from this
-- file's earlier draft was never run) — also a plain CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public._sr_primary_branch(p_agent_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT t.branch_id
  FROM public.sr_inventory si
  JOIN public.transactions t ON t.id = si.transaction_id
  WHERE si.sr_id = p_agent_id AND si.remaining_quantity > 0
  GROUP BY t.branch_id
  ORDER BY SUM(si.remaining_quantity) DESC, t.branch_id
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._sr_primary_branch(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._build_daily_report(
  p_agent_id uuid,
  p_branch_id uuid,
  p_report_date date,
  p_is_auto_filed boolean,
  p_items jsonb,
  p_latitude double precision,
  p_longitude double precision,
  p_device_model text,
  p_device_os text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_report_id uuid;
  v_custody_codes text[];
  v_given_codes text[];
  v_product RECORD;
  v_item jsonb;
  v_sold integer;
  v_return integer;
  v_in_custody integer;
  v_product_name text;
  v_report_item_id uuid;
  v_resolution_status text;
  v_seq integer;
  v_batch RECORD;
BEGIN
  INSERT INTO public.daily_reports
    (agent_id, branch_id, report_date, is_auto_filed, status,
     device_model, device_os, latitude, longitude, resolved_at)
    VALUES (
      p_agent_id, p_branch_id, p_report_date, p_is_auto_filed,
      CASE WHEN p_is_auto_filed THEN 'accepted' ELSE 'pending' END,
      p_device_model, p_device_os, p_latitude, p_longitude,
      CASE WHEN p_is_auto_filed THEN now() ELSE NULL END
    )
    RETURNING id INTO v_report_id;

  -- Only stock that (a) existed as of p_report_date (Manila time) and
  -- (b) came from p_branch_id's own transactions is ever swept into this
  -- report. (b) is the fix: without it, a multi-branch agent's report could
  -- never pass the "exact match" check below the moment they held different
  -- products per branch, since the client only ever submits one branch's
  -- worth of items.
  SELECT array_agg(DISTINCT si.product_code ORDER BY si.product_code)
    INTO v_custody_codes
    FROM public.sr_inventory si
    JOIN public.transactions t ON t.id = si.transaction_id
    WHERE si.sr_id = p_agent_id AND si.remaining_quantity > 0
      AND (si.created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date
      AND t.branch_id = p_branch_id;

  IF p_is_auto_filed THEN
    p_items := COALESCE((
      SELECT jsonb_agg(jsonb_build_object('product_code', product_code, 'sold_quantity', 0, 'return_quantity', 0))
      FROM (SELECT DISTINCT si.product_code FROM public.sr_inventory si
            JOIN public.transactions t ON t.id = si.transaction_id
            WHERE si.sr_id = p_agent_id AND si.remaining_quantity > 0
              AND (si.created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date
              AND t.branch_id = p_branch_id) p
    ), '[]'::jsonb);
  END IF;

  SELECT array_agg(x ORDER BY x) INTO v_given_codes
    FROM (SELECT DISTINCT (elem->>'product_code') AS x FROM jsonb_array_elements(p_items) elem) s;

  IF NOT p_is_auto_filed THEN
    IF COALESCE(v_custody_codes, '{}') IS DISTINCT FROM COALESCE(v_given_codes, '{}') THEN
      RAISE EXCEPTION 'Report must cover exactly your current in-custody products (given: %, expected: %)',
        v_given_codes, v_custody_codes;
    END IF;
  END IF;

  IF v_custody_codes IS NULL THEN
    RETURN v_report_id;
  END IF;

  FOR v_product IN SELECT unnest(v_custody_codes) AS product_code ORDER BY 1
  LOOP
    v_item := (SELECT elem FROM jsonb_array_elements(p_items) elem
               WHERE elem->>'product_code' = v_product.product_code LIMIT 1);
    v_sold := COALESCE((v_item->>'sold_quantity')::integer, 0);
    v_return := COALESCE((v_item->>'return_quantity')::integer, 0);
    IF v_sold < 0 OR v_return < 0 THEN
      RAISE EXCEPTION 'sold_quantity/return_quantity must not be negative (product %)', v_product.product_code;
    END IF;

    SELECT si.product_name INTO v_product_name FROM public.sr_inventory si
      JOIN public.transactions t ON t.id = si.transaction_id
      WHERE si.sr_id = p_agent_id AND si.product_code = v_product.product_code AND t.branch_id = p_branch_id
      ORDER BY si.created_at DESC LIMIT 1;

    v_in_custody := 0;
    FOR v_batch IN
      SELECT si.id, si.remaining_quantity FROM public.sr_inventory si
      JOIN public.transactions t ON t.id = si.transaction_id
      WHERE si.sr_id = p_agent_id AND si.product_code = v_product.product_code AND si.remaining_quantity > 0
        AND (si.created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date
        AND t.branch_id = p_branch_id
      ORDER BY si.created_at ASC, si.id ASC
      FOR UPDATE OF si
    LOOP
      v_in_custody := v_in_custody + v_batch.remaining_quantity;
    END LOOP;

    -- Defense in depth: sold+return must not exceed what was actually in
    -- custody. The client (SubmitReportSR.js) now clamps this as you type,
    -- but nothing at the schema level ever enforced it server-side —
    -- daily_report_items only checks each column is >= 0 on its own, not
    -- their relationship to in_custody_quantity.
    IF (v_sold + v_return) > v_in_custody THEN
      RAISE EXCEPTION 'Sold + returned (%) cannot exceed in-custody quantity (%) for product %',
        v_sold + v_return, v_in_custody, v_product.product_code;
    END IF;

    v_resolution_status := CASE WHEN (v_sold + v_return) = v_in_custody THEN 'none' ELSE 'open' END;

    INSERT INTO public.daily_report_items
      (report_id, product_code, product_name, in_custody_quantity, sold_quantity, return_quantity, resolution_status)
      VALUES (v_report_id, v_product.product_code, v_product_name, v_in_custody, v_sold, v_return, v_resolution_status)
      RETURNING id INTO v_report_item_id;

    v_seq := 0;
    FOR v_batch IN
      SELECT si.id, si.batch_number, si.mfg_date, si.exp_date, si.remaining_quantity FROM public.sr_inventory si
      JOIN public.transactions t ON t.id = si.transaction_id
      WHERE si.sr_id = p_agent_id AND si.product_code = v_product.product_code AND si.remaining_quantity > 0
        AND (si.created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date
        AND t.branch_id = p_branch_id
      ORDER BY si.created_at ASC, si.id ASC
    LOOP
      INSERT INTO public.daily_report_item_batches
        (report_item_id, sr_inventory_id, batch_sequence, batch_number, mfg_date, exp_date, quantity_consumed)
        VALUES (v_report_item_id, v_batch.id, v_seq, v_batch.batch_number, v_batch.mfg_date, v_batch.exp_date, v_batch.remaining_quantity);
      UPDATE public.sr_inventory SET remaining_quantity = 0 WHERE id = v_batch.id;
      v_seq := v_seq + 1;
    END LOOP;
  END LOOP;

  RETURN v_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._file_overdue_sr_reports(p_agent_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_branch_ids uuid[];
  v_branch_id uuid;
  v_business_today date := public._sr_business_date();
  v_cursor_date date;
  v_start_date date;
BEGIN
  SELECT branch_ids INTO v_branch_ids FROM public.user_profiles WHERE id = p_agent_id;
  IF v_branch_ids IS NULL OR array_length(v_branch_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- The branch the agent's stock actually belongs to, not just "the first
  -- one on file" — keeps this in sync with submit_daily_report /
  -- get_my_sr_report_status, which both derive it the same way.
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
  WHILE v_cursor_date < v_business_today LOOP
    -- Only file a loss report for this day if stock existed AS OF this day,
    -- IN THIS BRANCH specifically — keeps this check consistent with what
    -- _build_daily_report will actually find for p_branch_id.
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

CREATE OR REPLACE FUNCTION public.get_my_sr_report_status(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_today date;
  v_result jsonb;
  v_items jsonb;
  v_already_submitted boolean;
  v_branch_id uuid;
  v_branch_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'sales_rep') THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  PERFORM public._file_overdue_sr_reports(p_agent_id);

  v_business_today := public._sr_business_date();

  SELECT EXISTS (
    SELECT 1 FROM public.daily_reports WHERE agent_id = p_agent_id AND report_date = v_business_today
  ) INTO v_already_submitted;

  v_branch_id := public._sr_primary_branch(p_agent_id);
  IF v_branch_id IS NULL THEN
    SELECT branch_ids[1] INTO v_branch_id FROM public.user_profiles
      WHERE id = p_agent_id AND branch_ids IS NOT NULL AND array_length(branch_ids, 1) IS NOT NULL;
  END IF;
  SELECT name INTO v_branch_name FROM public.branches WHERE id = v_branch_id;

  -- Items are now scoped to v_branch_id (via the transaction each batch
  -- came from) instead of summing across every branch the agent has ever
  -- held stock in — this is also the fix for the separate "In Custody
  -- looked wrong" report: the old unscoped SUM could silently merge two
  -- branches' quantities into one figure.
  SELECT COALESCE(jsonb_agg(row_data ORDER BY product_code), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'productCode', si.product_code,
      'productName', (array_agg(si.product_name ORDER BY si.created_at DESC))[1],
      'inCustodyQuantity', SUM(si.remaining_quantity),
      'batches', jsonb_agg(jsonb_build_object(
        'batchNumber', si.batch_number, 'quantity', si.remaining_quantity,
        'mfgDate', si.mfg_date, 'expDate', si.exp_date, 'receivedAt', si.created_at
      ) ORDER BY si.created_at)
    ) AS row_data, si.product_code
    FROM public.sr_inventory si
    JOIN public.transactions t ON t.id = si.transaction_id
    WHERE si.sr_id = p_agent_id AND si.remaining_quantity > 0
      AND (v_branch_id IS NULL OR t.branch_id = v_branch_id)
    GROUP BY si.product_code
  ) sub;

  v_result := jsonb_build_object(
    'reportDate', v_business_today,
    'alreadySubmitted', v_already_submitted,
    'branchId', v_branch_id,
    'branchName', v_branch_name,
    'items', v_items
  );

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_sr_report_status(uuid) TO anon;

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

  -- Branch is derived from where the agent's current in-custody stock
  -- actually came from (the receiving transaction's branch_id) — the agent
  -- never picks it. Matches get_my_sr_report_status exactly, so the items
  -- shown on screen and the branch this report is filed under always agree.
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
        'ManageReturns'
      );
    END LOOP;
  END;

  RETURN jsonb_build_object('reportId', v_report_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_daily_report(uuid, double precision, double precision, text, text, text, jsonb) TO anon;

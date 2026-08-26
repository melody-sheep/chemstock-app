-- ============================================================
-- Fix: _file_overdue_sr_reports / _build_daily_report incorrectly swept
-- CURRENTLY-held stock into a stale backlog day's loss report, instead of
-- only stock that actually existed as of that day. This meant freshly
-- scanned/received stock could get silently drained into a bogus old-date
-- loss report the moment an SR with a pre-existing backlog opened Submit
-- Report, and could also create duplicate discrepancy lines for the same
-- product across different bogus backlog days.
--
-- Fix: every sr_inventory query inside these two functions now additionally
-- requires (created_at AT TIME ZONE 'Asia/Manila')::date <= the report date
-- being built/checked. For the manual submit path, p_report_date is always
-- today, so this filter is a no-op there (nothing can have a future
-- created_at) — it only changes behavior for the auto-file backlog path.
--
-- Both functions are internal helpers (no GRANT, called only from other
-- SECURITY DEFINER functions) with unchanged argument lists, so CREATE OR
-- REPLACE is safe here — no DROP FUNCTION needed.
-- ============================================================

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

  -- Only stock that actually existed as of p_report_date (Manila time) is
  -- ever swept into this report — this is the fix.
  SELECT array_agg(DISTINCT product_code ORDER BY product_code)
    INTO v_custody_codes
    FROM public.sr_inventory
    WHERE sr_id = p_agent_id AND remaining_quantity > 0
      AND (created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date;

  IF p_is_auto_filed THEN
    p_items := COALESCE((
      SELECT jsonb_agg(jsonb_build_object('product_code', product_code, 'sold_quantity', 0, 'return_quantity', 0))
      FROM (SELECT DISTINCT product_code FROM public.sr_inventory
            WHERE sr_id = p_agent_id AND remaining_quantity > 0
              AND (created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date) p
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

    SELECT product_name INTO v_product_name FROM public.sr_inventory
      WHERE sr_id = p_agent_id AND product_code = v_product.product_code
      ORDER BY created_at DESC LIMIT 1;

    v_in_custody := 0;
    FOR v_batch IN
      SELECT id, remaining_quantity FROM public.sr_inventory
      WHERE sr_id = p_agent_id AND product_code = v_product.product_code AND remaining_quantity > 0
        AND (created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      v_in_custody := v_in_custody + v_batch.remaining_quantity;
    END LOOP;

    v_resolution_status := CASE WHEN (v_sold + v_return) = v_in_custody THEN 'none' ELSE 'open' END;

    INSERT INTO public.daily_report_items
      (report_id, product_code, product_name, in_custody_quantity, sold_quantity, return_quantity, resolution_status)
      VALUES (v_report_id, v_product.product_code, v_product_name, v_in_custody, v_sold, v_return, v_resolution_status)
      RETURNING id INTO v_report_item_id;

    v_seq := 0;
    FOR v_batch IN
      SELECT id, batch_number, mfg_date, exp_date, remaining_quantity FROM public.sr_inventory
      WHERE sr_id = p_agent_id AND product_code = v_product.product_code AND remaining_quantity > 0
        AND (created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date
      ORDER BY created_at ASC, id ASC
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
  v_branch_id := v_branch_ids[1];

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
    -- Only file a loss report for this day if stock existed AS OF this day
    -- specifically — this is the fix. Stock received later no longer
    -- falsely triggers (or gets swept into) a stale day's auto-file.
    IF EXISTS (
      SELECT 1 FROM public.sr_inventory
      WHERE sr_id = p_agent_id AND remaining_quantity > 0
        AND (created_at AT TIME ZONE 'Asia/Manila')::date <= v_cursor_date
    ) THEN
      PERFORM public._build_daily_report(p_agent_id, v_branch_id, v_cursor_date, true, NULL, NULL, NULL, NULL, NULL);
    END IF;
    v_cursor_date := v_cursor_date + 1;
  END LOOP;
END;
$$;

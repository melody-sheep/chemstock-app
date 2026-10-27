-- Keep the Sales Rep's unreported stock in sr_inventory and carry it into
-- the next report. Only sold and returned quantities leave the backpack.
-- The shortfall remains a report discrepancy; a negative discrepancy is not
-- proof that stock is physically missing. Label it "Missing on report" and
-- retain the stock in inventory. Historical lines are superseded as
-- carried_forward; alerts/resolutions use the latest active report item.

BEGIN;

ALTER TABLE public.daily_reports
  ADD COLUMN IF NOT EXISTS carry_forward_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.daily_report_items
  DROP CONSTRAINT IF EXISTS daily_report_items_resolution_status_check;

ALTER TABLE public.daily_report_items
  ADD CONSTRAINT daily_report_items_resolution_status_check
  CHECK (resolution_status IN ('none', 'open', 'resolved', 'carried_forward'));

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
  v_stale_request RECORD;
  v_to_consume integer;
  v_take integer;
BEGIN
  INSERT INTO public.daily_reports
    (agent_id, branch_id, report_date, is_auto_filed, status,
     device_model, device_os, latitude, longitude, resolved_at, carry_forward_enabled)
    VALUES (
      p_agent_id, p_branch_id, p_report_date, p_is_auto_filed,
      CASE WHEN p_is_auto_filed THEN 'accepted' ELSE 'pending' END,
      p_device_model, p_device_os, p_latitude, p_longitude,
      CASE WHEN p_is_auto_filed THEN now() ELSE NULL END, true
    )
    RETURNING id INTO v_report_id;

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
      FROM (
        SELECT DISTINCT si.product_code
        FROM public.sr_inventory si
        JOIN public.transactions t ON t.id = si.transaction_id
        WHERE si.sr_id = p_agent_id AND si.remaining_quantity > 0
          AND (si.created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date
          AND t.branch_id = p_branch_id
      ) p
    ), '[]'::jsonb);
  END IF;

  SELECT array_agg(x ORDER BY x)
    INTO v_given_codes
    FROM (
      SELECT DISTINCT (elem->>'product_code') AS x
      FROM jsonb_array_elements(p_items) elem
    ) s;

  IF NOT p_is_auto_filed
     AND COALESCE(v_custody_codes, '{}') IS DISTINCT FROM COALESCE(v_given_codes, '{}') THEN
    RAISE EXCEPTION 'Report must cover exactly your current in-custody products (given: %, expected: %)',
      v_given_codes, v_custody_codes;
  END IF;

  IF v_custody_codes IS NULL THEN
    RETURN v_report_id;
  END IF;

  FOR v_product IN
    SELECT unnest(v_custody_codes) AS product_code
    ORDER BY 1
  LOOP
    v_item := (
      SELECT elem
      FROM jsonb_array_elements(p_items) elem
      WHERE elem->>'product_code' = v_product.product_code
      LIMIT 1
    );
    v_sold := COALESCE((v_item->>'sold_quantity')::integer, 0);
    v_return := COALESCE((v_item->>'return_quantity')::integer, 0);
    IF v_sold < 0 OR v_return < 0 THEN
      RAISE EXCEPTION 'sold_quantity/return_quantity must not be negative (product %)', v_product.product_code;
    END IF;

    SELECT si.product_name INTO v_product_name
    FROM public.sr_inventory si
    JOIN public.transactions t ON t.id = si.transaction_id
    WHERE si.sr_id = p_agent_id
      AND si.product_code = v_product.product_code
      AND t.branch_id = p_branch_id
    ORDER BY si.created_at DESC
    LIMIT 1;

    -- Match the accept flow's item -> request -> inventory lock order.
    PERFORM old_item.id
    FROM public.daily_report_items old_item
    JOIN public.daily_reports old_report ON old_report.id = old_item.report_id
    WHERE old_report.carry_forward_enabled
      AND old_report.agent_id = p_agent_id
      AND old_report.branch_id = p_branch_id
      AND old_item.product_code = v_product.product_code
      AND old_item.resolution_status = 'open'
    ORDER BY old_item.id
    FOR UPDATE OF old_item;

    v_in_custody := 0;
    FOR v_batch IN
      SELECT si.id, si.remaining_quantity
      FROM public.sr_inventory si
      JOIN public.transactions t ON t.id = si.transaction_id
      WHERE si.sr_id = p_agent_id
        AND si.product_code = v_product.product_code
        AND si.remaining_quantity > 0
        AND (si.created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date
        AND t.branch_id = p_branch_id
      ORDER BY si.created_at ASC, si.id ASC
      FOR UPDATE OF si
    LOOP
      v_in_custody := v_in_custody + v_batch.remaining_quantity;
    END LOOP;

    IF (v_sold + v_return) > v_in_custody THEN
      RAISE EXCEPTION 'Sold + returned (%) cannot exceed in-custody quantity (%) for product %',
        v_sold + v_return, v_in_custody, v_product.product_code;
    END IF;

    v_resolution_status := CASE
      WHEN (v_sold + v_return) = v_in_custody THEN 'none'
      ELSE 'open'
    END;

    FOR v_stale_request IN
      UPDATE public.discrepancy_resolutions drs
      SET status = 'rejected',
          resolved_at = now(),
          reject_reason = 'A newer daily report replaced this carry-forward balance. Submit a new request if stock still needs to be returned.'
      FROM public.daily_report_items old_item
      JOIN public.daily_reports old_report ON old_report.id = old_item.report_id
      WHERE drs.report_item_id = old_item.id
        AND drs.status = 'pending'
        AND old_report.carry_forward_enabled
        AND old_report.agent_id = p_agent_id
        AND old_report.branch_id = p_branch_id
        AND old_item.product_code = v_product.product_code
        AND old_item.resolution_status = 'open'
      RETURNING drs.id, drs.agent_id, old_item.product_name
    LOOP
      PERFORM public._notify(
        v_stale_request.agent_id,
        'return_request_resolved',
        'Return request needs an update',
        'A newer daily report replaced the balance for ' || v_stale_request.product_name
          || '. Submit a new return request if stock still needs to be returned.',
        'ReturnStocksSR',
        jsonb_build_object('focusId', v_stale_request.id)
      );
    END LOOP;

    UPDATE public.daily_report_items old_item
    SET resolution_status = 'carried_forward'
    FROM public.daily_reports old_report
    WHERE old_report.id = old_item.report_id
      AND old_report.carry_forward_enabled
      AND old_report.agent_id = p_agent_id
      AND old_report.branch_id = p_branch_id
      AND old_item.product_code = v_product.product_code
      AND old_item.resolution_status = 'open';

    INSERT INTO public.daily_report_items
      (report_id, product_code, product_name, in_custody_quantity, sold_quantity, return_quantity, resolution_status)
      VALUES (v_report_id, v_product.product_code, v_product_name, v_in_custody, v_sold, v_return, v_resolution_status)
      RETURNING id INTO v_report_item_id;

    v_seq := 0;
    v_to_consume := v_sold + v_return;
    FOR v_batch IN
      SELECT si.id, si.batch_number, si.mfg_date, si.exp_date, si.remaining_quantity
      FROM public.sr_inventory si
      JOIN public.transactions t ON t.id = si.transaction_id
      WHERE si.sr_id = p_agent_id
        AND si.product_code = v_product.product_code
        AND si.remaining_quantity > 0
        AND (si.created_at AT TIME ZONE 'Asia/Manila')::date <= p_report_date
        AND t.branch_id = p_branch_id
      ORDER BY si.created_at ASC, si.id ASC
    LOOP
      INSERT INTO public.daily_report_item_batches
        (report_item_id, sr_inventory_id, batch_sequence, batch_number, mfg_date, exp_date, quantity_consumed)
        VALUES (v_report_item_id, v_batch.id, v_seq, v_batch.batch_number, v_batch.mfg_date, v_batch.exp_date, v_batch.remaining_quantity);

      v_take := LEAST(v_batch.remaining_quantity, v_to_consume);
      IF v_take > 0 THEN
        UPDATE public.sr_inventory
        SET remaining_quantity = remaining_quantity - v_take
        WHERE id = v_batch.id;
        v_to_consume := v_to_consume - v_take;
      END IF;
      v_seq := v_seq + 1;
    END LOOP;
  END LOOP;

  RETURN v_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public._build_daily_report(uuid, uuid, date, boolean, jsonb, double precision, double precision, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_my_daily_reports(p_agent_id uuid, p_limit integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'sales_rep') THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_key DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'reportId', dr.id, 'reportDate', dr.report_date, 'status', dr.status,
      'isAutoFiled', dr.is_auto_filed, 'carryForwardEnabled', dr.carry_forward_enabled,
      'createdAt', dr.created_at, 'resolvedAt', dr.resolved_at,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'reportItemId', dri.id, 'productCode', dri.product_code, 'productName', dri.product_name,
          'inCustodyQuantity', dri.in_custody_quantity, 'soldQuantity', dri.sold_quantity,
          'returnQuantity', dri.return_quantity, 'discrepancy', dri.discrepancy,
          'resolutionStatus', dri.resolution_status
        ) ORDER BY dri.product_code)
        FROM public.daily_report_items dri WHERE dri.report_id = dr.id
      ), '[]'::jsonb)
    ) AS row_data, dr.report_date AS sort_key
    FROM public.daily_reports dr
    WHERE dr.agent_id = p_agent_id
    ORDER BY dr.report_date DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_daily_reports(uuid, integer) TO anon;

CREATE OR REPLACE FUNCTION public.get_my_discrepancies(p_agent_id uuid, p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'sales_rep') THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_key DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'reportItemId', dri.id, 'reportId', dr.id, 'reportDate', dr.report_date,
      'productCode', dri.product_code, 'productName', dri.product_name,
      'inCustodyQuantity', dri.in_custody_quantity, 'soldQuantity', dri.sold_quantity,
      'returnQuantity', dri.return_quantity, 'discrepancy', dri.discrepancy,
      'discrepancyType', CASE WHEN dri.discrepancy < 0 THEN 'loss' ELSE 'over' END,
      'resolutionStatus', dri.resolution_status,
      'carryForwardEnabled', dr.carry_forward_enabled,
      'latestRequest', (
        SELECT jsonb_build_object('id', x.id, 'status', x.status, 'rejectReason', x.reject_reason, 'createdAt', x.created_at)
        FROM public.discrepancy_resolutions x WHERE x.report_item_id = dri.id
        ORDER BY x.created_at DESC LIMIT 1
      )
    ) AS row_data, dr.report_date AS sort_key
    FROM public.daily_report_items dri
    JOIN public.daily_reports dr ON dr.id = dri.report_id
    WHERE dr.agent_id = p_agent_id
      AND dri.discrepancy <> 0
      AND dri.resolution_status <> 'carried_forward'
    ORDER BY dr.report_date DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_discrepancies(uuid, integer) TO anon;

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
      'isAutoFiled', dr.is_auto_filed, 'carryForwardEnabled', dr.carry_forward_enabled,
      'createdAt', dr.created_at, 'resolvedAt', dr.resolved_at,
      'agentId', dr.agent_id, 'agentName', ag.full_name,
      'branchId', dr.branch_id, 'branchName', br.name, 'mediaPath', m.storage_path,
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
      'carryForwardEnabled', dr.carry_forward_enabled,
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
      AND dri.resolution_status <> 'carried_forward'
    ORDER BY dr.report_date DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_branch_discrepancies(integer) TO authenticated;

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
  v_stock RECORD;
  v_to_remove integer;
  v_take integer;
BEGIN
  SELECT report_item_id INTO v_item_id
  FROM public.discrepancy_resolutions
  WHERE id = p_request_id;
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
  IF v_item.resolution_status <> 'open' THEN
    RAISE EXCEPTION 'This discrepancy has been carried into a newer report and can no longer be accepted';
  END IF;

  v_loss_qty := GREATEST(v_item.in_custody_quantity - v_item.sold_quantity - v_item.return_quantity, 0);
  IF v_loss_qty > 0 THEN
    CREATE TEMP TABLE _resolution_credits (batch_number text PRIMARY KEY, credit_qty integer NOT NULL) ON COMMIT DROP;

    FOR v_alloc IN
      SELECT * FROM public._allocate_report_item_batches(v_item.id, v_item.sold_quantity + v_item.return_quantity, v_loss_qty)
    LOOP
      INSERT INTO _resolution_credits (batch_number, credit_qty)
      VALUES (v_alloc.batch_number, v_alloc.quantity)
      ON CONFLICT (batch_number) DO UPDATE
      SET credit_qty = _resolution_credits.credit_qty + EXCLUDED.credit_qty;
    END LOOP;

    FOR v_credit IN SELECT * FROM _resolution_credits ORDER BY batch_number
    LOOP
      IF v_report.carry_forward_enabled THEN
        v_to_remove := v_credit.credit_qty;
        FOR v_stock IN
          SELECT si.id, si.remaining_quantity
          FROM public.sr_inventory si
          JOIN public.transactions t ON t.id = si.transaction_id
          WHERE si.sr_id = v_report.agent_id
            AND t.branch_id = v_report.branch_id
            AND si.batch_number = v_credit.batch_number
            AND si.remaining_quantity > 0
          ORDER BY si.created_at ASC, si.id ASC
          FOR UPDATE OF si
        LOOP
          v_take := LEAST(v_stock.remaining_quantity, v_to_remove);
          UPDATE public.sr_inventory
          SET remaining_quantity = remaining_quantity - v_take
          WHERE id = v_stock.id;
          v_to_remove := v_to_remove - v_take;
          EXIT WHEN v_to_remove = 0;
        END LOOP;
        IF v_to_remove > 0 THEN
          RAISE EXCEPTION 'Cannot accept this return: only % of the reported batch remains in the Sales Rep backpack',
            v_credit.credit_qty - v_to_remove;
        END IF;
      END IF;

      PERFORM 1 FROM public.branch_inventory
      WHERE branch_id = v_report.branch_id AND batch_number = v_credit.batch_number
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Batch % no longer exists in branch inventory — cannot credit recovered stock', v_credit.batch_number;
      END IF;
      UPDATE public.branch_inventory
      SET quantity = quantity + v_credit.credit_qty
      WHERE branch_id = v_report.branch_id AND batch_number = v_credit.batch_number;
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
GRANT EXECUTE ON FUNCTION public.accept_discrepancy_resolution(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._trg_notify_discrepancy_found()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.daily_reports;
  v_name text;
  v_manager_id uuid;
  v_params jsonb;
  v_title text;
  v_body text;
BEGIN
  IF NEW.resolution_status <> 'open' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_report FROM public.daily_reports WHERE id = NEW.report_id;
  v_params := jsonb_build_object('focusId', NEW.report_id);
  v_title := CASE
    WHEN v_report.carry_forward_enabled THEN 'Missing on report — still in backpack; carried forward'
    ELSE 'Discrepancy found'
  END;
  v_body := CASE WHEN v_report.carry_forward_enabled
    THEN 'Missing on report — still in your backpack; carried forward to your next report. This is a report discrepancy, not confirmation that stock is physically lost.'
    ELSE 'Your report has missing stock. Open Alerts to resolve it.'
  END;

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE recipient_id = v_report.agent_id AND type = 'discrepancy_found' AND nav_params = v_params
  ) THEN
    PERFORM public._notify(
      v_report.agent_id, 'discrepancy_found', v_title, v_body,
      'AlertsDiscrepanciesSR', v_params
    );
  END IF;

  SELECT full_name INTO v_name FROM public.user_profiles WHERE id = v_report.agent_id;
  FOR v_manager_id IN
    SELECT id FROM public.user_profiles WHERE role = 'manager' AND v_report.branch_id = ANY(branch_ids)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE recipient_id = v_manager_id AND type = 'discrepancy_found' AND nav_params = v_params
    ) THEN
      PERFORM public._notify(
        v_manager_id, 'discrepancy_found',
        CASE
          WHEN v_report.carry_forward_enabled THEN 'Missing on report — still in backpack; carried forward'
          ELSE 'Discrepancy found'
        END,
        CASE WHEN v_report.carry_forward_enabled
          THEN 'Missing on report — ' || COALESCE(v_name, 'A sales rep')
            || '''s stock is still in their backpack and carried forward. This is a report discrepancy, not confirmation of physical loss.'
          ELSE COALESCE(v_name, 'A sales rep') || '''s report has missing stock.'
        END,
        'ManagerAlerts', v_params
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_branch_report(
  p_branch_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_products jsonb;
  v_system_details jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager' AND p_branch_id = ANY(branch_ids)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY product_code), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT jsonb_build_object(
      'productCode', p.product_code, 'productName', p.product_name,
      'actualInventory', COALESCE(bi.actual_inv, 0),
      'sales', COALESCE(p.sales, 0), 'returned', COALESCE(p.returned, 0),
      'loss', COALESCE(p.loss, 0), 'over', COALESCE(p.over, 0),
      'status', CASE WHEN p.has_unresolved THEN 'Unresolved' ELSE 'Resolved' END
    ) AS row_data, p.product_code
    FROM (
      SELECT
        dri.product_code,
        (array_agg(dri.product_name ORDER BY dr.created_at DESC))[1] AS product_name,
        SUM(dri.sold_quantity) AS sales,
        SUM(dri.return_quantity) AS returned,
        SUM(GREATEST(-dri.discrepancy, 0)) FILTER (
          WHERE dri.resolution_status <> 'carried_forward'
            AND NOT (dr.carry_forward_enabled AND dri.discrepancy < 0)
        ) AS loss,
        SUM(GREATEST(dri.discrepancy, 0)) FILTER (WHERE dri.resolution_status <> 'carried_forward') AS over,
        BOOL_OR(
          dri.discrepancy <> 0
          AND dri.resolution_status NOT IN ('resolved', 'carried_forward')
          AND NOT (dr.carry_forward_enabled AND dri.discrepancy < 0)
        ) AS has_unresolved
      FROM public.daily_report_items dri
      JOIN public.daily_reports dr ON dr.id = dri.report_id
      WHERE dr.branch_id = p_branch_id AND dr.status = 'accepted'
        AND dr.report_date BETWEEN p_period_start AND p_period_end
      GROUP BY dri.product_code
    ) p
    LEFT JOIN (
      SELECT product_code, SUM(quantity) AS actual_inv
      FROM public.branch_inventory WHERE branch_id = p_branch_id
      GROUP BY product_code
    ) bi ON bi.product_code = p.product_code
  ) sub;

  SELECT jsonb_build_object(
    'reportsAccepted', (
      SELECT COUNT(*) FROM public.daily_reports
      WHERE branch_id = p_branch_id AND status = 'accepted'
        AND report_date BETWEEN p_period_start AND p_period_end
    ),
    'reportsAutoFiled', (
      SELECT COUNT(*) FROM public.daily_reports
      WHERE branch_id = p_branch_id AND is_auto_filed
        AND report_date BETWEEN p_period_start AND p_period_end
    ),
    'discrepancyResolutionsAccepted', (
      SELECT COUNT(*) FROM public.discrepancy_resolutions dres
      JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
      JOIN public.daily_reports dr ON dr.id = dri.report_id
      WHERE dr.branch_id = p_branch_id AND dres.status = 'accepted'
        AND dr.report_date BETWEEN p_period_start AND p_period_end
    ),
    'photoVerifiedResolutions', (
      SELECT COUNT(*) FROM public.discrepancy_resolutions dres
      JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
      JOIN public.daily_reports dr ON dr.id = dri.report_id
      WHERE dr.branch_id = p_branch_id AND dres.media_id IS NOT NULL
        AND dr.report_date BETWEEN p_period_start AND p_period_end
    ),
    'geotaggedResolutions', (
      SELECT COUNT(*) FROM public.discrepancy_resolutions dres
      JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
      JOIN public.daily_reports dr ON dr.id = dri.report_id
      WHERE dr.branch_id = p_branch_id AND dres.gps_id IS NOT NULL
        AND dr.report_date BETWEEN p_period_start AND p_period_end
    )
  ) INTO v_system_details;

  RETURN jsonb_build_object(
    'branchId', p_branch_id, 'periodStart', p_period_start, 'periodEnd', p_period_end,
    'products', v_products, 'systemDetails', v_system_details
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_branch_report(uuid, date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

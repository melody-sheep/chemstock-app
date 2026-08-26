-- ============================================================
-- Sales Rep Daily Reports, Discrepancies & Returns
-- + Manager Reports & Returns / Alerts & Discrepancies / Weekly-Monthly Report
-- ============================================================

-- ============================================================
-- 0. sr_inventory: add remaining_quantity (mutable "still-held" counter).
--    quantity stays exactly as-is (immutable "originally received" amount —
--    every existing reader of it, get_sr_inventory/accept_stock_release,
--    keeps working unchanged). remaining_quantity is seeded from quantity by
--    trigger, same technique as branch_inventory.received_quantity.
-- ============================================================
ALTER TABLE public.sr_inventory ADD COLUMN IF NOT EXISTS remaining_quantity integer;
UPDATE public.sr_inventory SET remaining_quantity = quantity WHERE remaining_quantity IS NULL;
ALTER TABLE public.sr_inventory ALTER COLUMN remaining_quantity SET NOT NULL;
ALTER TABLE public.sr_inventory ADD CONSTRAINT sr_inventory_remaining_quantity_check
  CHECK (remaining_quantity >= 0 AND remaining_quantity <= quantity);

CREATE OR REPLACE FUNCTION public.set_sr_inventory_remaining_quantity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.remaining_quantity := NEW.quantity;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_sr_inventory_remaining_quantity ON public.sr_inventory;
CREATE TRIGGER trg_set_sr_inventory_remaining_quantity
  BEFORE INSERT ON public.sr_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sr_inventory_remaining_quantity();

-- Partial index: every "current custody" query filters remaining_quantity > 0.
CREATE INDEX IF NOT EXISTS sr_inventory_sr_id_product_code_remaining_idx
  ON public.sr_inventory (sr_id, product_code)
  WHERE remaining_quantity > 0;

-- ============================================================
-- 1. daily_reports (header) — one per agent per business day.
-- ============================================================
CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.user_profiles(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  report_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  is_auto_filed boolean NOT NULL DEFAULT false,
  device_model text,
  device_os text,
  latitude double precision,
  longitude double precision,
  resolved_by uuid REFERENCES public.user_profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, report_date)
);
CREATE INDEX ON public.daily_reports (branch_id);
CREATE INDEX ON public.daily_reports (agent_id);
CREATE INDEX ON public.daily_reports (status);

-- ============================================================
-- 2. daily_report_items — per-product line items. discrepancy is a
--    generated column: (sold + return) - in_custody.
-- ============================================================
CREATE TABLE public.daily_report_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.daily_reports(id),
  product_code text NOT NULL,
  product_name text NOT NULL,
  in_custody_quantity integer NOT NULL CHECK (in_custody_quantity >= 0),
  sold_quantity integer NOT NULL CHECK (sold_quantity >= 0),
  return_quantity integer NOT NULL CHECK (return_quantity >= 0),
  discrepancy integer GENERATED ALWAYS AS ((sold_quantity + return_quantity) - in_custody_quantity) STORED,
  resolution_status text NOT NULL DEFAULT 'none' CHECK (resolution_status IN ('none', 'open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, product_code)
);
CREATE INDEX ON public.daily_report_items (report_id);
CREATE INDEX ON public.daily_report_items (resolution_status);

-- ============================================================
-- 3. daily_report_item_batches — FIFO batch trail for a report item's
--    in-custody figure, so later branch_inventory credits know which
--    batch_number(s) to increment.
-- ============================================================
CREATE TABLE public.daily_report_item_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_item_id uuid NOT NULL REFERENCES public.daily_report_items(id),
  sr_inventory_id uuid NOT NULL REFERENCES public.sr_inventory(id),
  batch_sequence integer NOT NULL,
  batch_number text,
  mfg_date date,
  exp_date date,
  quantity_consumed integer NOT NULL CHECK (quantity_consumed > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_item_id, batch_sequence)
);
CREATE INDEX ON public.daily_report_item_batches (report_item_id);
CREATE INDEX ON public.daily_report_item_batches (batch_number);

-- ============================================================
-- 4. discrepancy_resolutions — SR's "resolve discrepancy / return stock"
--    requests. No QR, photo proof only. Re-attemptable after rejection.
-- ============================================================
CREATE TABLE public.discrepancy_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_item_id uuid NOT NULL REFERENCES public.daily_report_items(id),
  agent_id uuid NOT NULL REFERENCES public.user_profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  gps_id uuid REFERENCES public.gps_coordinates(id),
  media_id uuid REFERENCES public.media(id),
  reject_reason text,
  resolved_by uuid REFERENCES public.user_profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.discrepancy_resolutions (report_item_id);
CREATE INDEX ON public.discrepancy_resolutions (agent_id);
CREATE INDEX ON public.discrepancy_resolutions (status);

CREATE UNIQUE INDEX discrepancy_resolutions_one_pending_per_item
  ON public.discrepancy_resolutions (report_item_id) WHERE status = 'pending';

-- ============================================================
-- 5. RLS policies
-- ============================================================
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_item_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discrepancy_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view daily reports for their branches"
  ON public.daily_reports FOR SELECT TO authenticated
  USING (branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Managers can view daily report items for their branches"
  ON public.daily_report_items FOR SELECT TO authenticated
  USING (report_id IN (
    SELECT id FROM public.daily_reports
    WHERE branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Managers can view daily report item batches for their branches"
  ON public.daily_report_item_batches FOR SELECT TO authenticated
  USING (report_item_id IN (
    SELECT dri.id FROM public.daily_report_items dri
    JOIN public.daily_reports dr ON dr.id = dri.report_id
    WHERE dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Managers can view discrepancy resolutions for their branches"
  ON public.discrepancy_resolutions FOR SELECT TO authenticated
  USING (report_item_id IN (
    SELECT dri.id FROM public.daily_report_items dri
    JOIN public.daily_reports dr ON dr.id = dri.report_id
    WHERE dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

-- gps_coordinates/media rows written by request_discrepancy_resolution are
-- always agent-owned, never manager auth.uid()-owned — same reason the
-- Collector delivery feature needed its own equivalent policies.
CREATE POLICY "Managers can view gps for their branches' discrepancy resolutions"
  ON public.gps_coordinates FOR SELECT TO authenticated
  USING (id IN (
    SELECT dres.gps_id FROM public.discrepancy_resolutions dres
    JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
    JOIN public.daily_reports dr ON dr.id = dri.report_id
    WHERE dres.gps_id IS NOT NULL
      AND dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Managers can view media for their branches' discrepancy resolutions"
  ON public.media FOR SELECT TO authenticated
  USING (id IN (
    SELECT dres.media_id FROM public.discrepancy_resolutions dres
    JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
    JOIN public.daily_reports dr ON dr.id = dri.report_id
    WHERE dres.media_id IS NOT NULL
      AND dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Managers can view discrepancy resolution media for their branches"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shipment-media' AND name IN (
    SELECT m.storage_path FROM public.media m
    JOIN public.discrepancy_resolutions dres ON dres.media_id = m.id
    JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
    JOIN public.daily_reports dr ON dr.id = dri.report_id
    WHERE dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

CREATE POLICY "Agents can upload their own discrepancy resolution photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'shipment-media' AND (storage.foldername(name))[1] = 'sr-discrepancy-resolutions');

CREATE POLICY "Agents can view their own discrepancy resolution photos"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'shipment-media' AND (storage.foldername(name))[1] = 'sr-discrepancy-resolutions');

-- ============================================================
-- 6. Internal helper functions (no GRANT — called only from within other
--    SECURITY DEFINER functions, run under that same elevated role).
-- ============================================================
CREATE OR REPLACE FUNCTION public._sr_business_date()
RETURNS date
LANGUAGE sql STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Asia/Manila')::date;
$$;
REVOKE ALL ON FUNCTION public._sr_business_date() FROM PUBLIC;

-- Given a report item's FIFO batch trail, returns which batch_number(s)
-- cover the half-open unit range [p_offset, p_offset + p_length).
CREATE OR REPLACE FUNCTION public._allocate_report_item_batches(
  p_report_item_id uuid,
  p_offset integer,
  p_length integer
)
RETURNS TABLE(batch_number text, quantity integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row RECORD;
  v_running integer := 0;
  v_start integer;
  v_end integer := p_offset + p_length;
  v_take integer;
BEGIN
  IF p_length <= 0 THEN
    RETURN;
  END IF;

  FOR v_row IN
    SELECT drib.batch_number, drib.quantity_consumed
    FROM public.daily_report_item_batches drib
    WHERE drib.report_item_id = p_report_item_id
    ORDER BY drib.batch_sequence ASC
  LOOP
    v_start := v_running;
    v_running := v_running + v_row.quantity_consumed;
    v_take := LEAST(v_running, v_end) - GREATEST(v_start, p_offset);
    IF v_take > 0 AND v_row.batch_number IS NOT NULL THEN
      batch_number := v_row.batch_number;
      quantity := v_take;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public._allocate_report_item_batches(uuid, integer, integer) FROM PUBLIC;

-- Builds ONE daily report (header + items + batch trail), fully consuming
-- 100% of current custody for every product touched.
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

  -- Canonical lock order: product_code ASC. Both this function and
  -- _file_overdue_sr_reports always walk products in this same order, so
  -- concurrent auto-file + manual-submit for the same agent can only block
  -- sequentially, never deadlock.
  SELECT array_agg(DISTINCT product_code ORDER BY product_code)
    INTO v_custody_codes
    FROM public.sr_inventory
    WHERE sr_id = p_agent_id AND remaining_quantity > 0;

  IF p_is_auto_filed THEN
    p_items := COALESCE((
      SELECT jsonb_agg(jsonb_build_object('product_code', product_code, 'sold_quantity', 0, 'return_quantity', 0))
      FROM (SELECT DISTINCT product_code FROM public.sr_inventory
            WHERE sr_id = p_agent_id AND remaining_quantity > 0) p
    ), '[]'::jsonb);
  END IF;

  SELECT array_agg(x ORDER BY x) INTO v_given_codes
    FROM (SELECT DISTINCT (elem->>'product_code') AS x FROM jsonb_array_elements(p_items) elem) s;

  IF NOT p_is_auto_filed THEN
    -- All-or-nothing: the submitted product set must exactly equal current
    -- custody — no cherry-picking, nothing left silently uncovered.
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

    -- Pass 1: lock every remaining batch row for this product, sum to get
    -- the authoritative in_custody_quantity (plain multi-row FOR UPDATE via
    -- a loop, not array_agg+FOR UPDATE — that combo is disallowed).
    v_in_custody := 0;
    FOR v_batch IN
      SELECT id, remaining_quantity FROM public.sr_inventory
      WHERE sr_id = p_agent_id AND product_code = v_product.product_code AND remaining_quantity > 0
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

    -- Pass 2: re-read the same (already-locked-in-this-transaction) rows to
    -- write the FIFO batch trail and drain them to 0.
    v_seq := 0;
    FOR v_batch IN
      SELECT id, batch_number, mfg_date, exp_date, remaining_quantity FROM public.sr_inventory
      WHERE sr_id = p_agent_id AND product_code = v_product.product_code AND remaining_quantity > 0
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
REVOKE ALL ON FUNCTION public._build_daily_report(uuid, uuid, date, boolean, jsonb, double precision, double precision, text, text) FROM PUBLIC;

-- Lazy on-access auto-file: walks every day strictly before "today" that has
-- no daily_reports row yet, and files a full-loss report for any such day
-- where the agent is (at that point in the walk) still holding stock.
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
    SELECT MIN(created_at)::date INTO v_start_date FROM public.sr_inventory WHERE sr_id = p_agent_id;
  END IF;
  IF v_start_date IS NULL THEN
    RETURN;
  END IF;

  v_cursor_date := v_start_date;
  WHILE v_cursor_date < v_business_today LOOP
    IF EXISTS (SELECT 1 FROM public.sr_inventory WHERE sr_id = p_agent_id AND remaining_quantity > 0) THEN
      PERFORM public._build_daily_report(p_agent_id, v_branch_id, v_cursor_date, true, NULL, NULL, NULL, NULL, NULL);
    END IF;
    v_cursor_date := v_cursor_date + 1;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public._file_overdue_sr_reports(uuid) FROM PUBLIC;

-- ============================================================
-- 7. Sales-Rep-facing RPCs (SECURITY DEFINER, GRANT TO anon)
-- ============================================================
CREATE OR REPLACE FUNCTION public.file_overdue_sr_reports(p_agent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'sales_rep') THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;
  PERFORM public._file_overdue_sr_reports(p_agent_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.file_overdue_sr_reports(uuid) TO anon;

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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'sales_rep') THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  PERFORM public._file_overdue_sr_reports(p_agent_id);

  v_business_today := public._sr_business_date();

  SELECT EXISTS (
    SELECT 1 FROM public.daily_reports WHERE agent_id = p_agent_id AND report_date = v_business_today
  ) INTO v_already_submitted;

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
    WHERE si.sr_id = p_agent_id AND si.remaining_quantity > 0
    GROUP BY si.product_code
  ) sub;

  v_result := jsonb_build_object(
    'reportDate', v_business_today,
    'alreadySubmitted', v_already_submitted,
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

  PERFORM public._file_overdue_sr_reports(p_agent_id);

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one product line is required';
  END IF;

  v_report_id := public._build_daily_report(
    p_agent_id, v_branch_ids[1], public._sr_business_date(), false, p_items,
    p_latitude, p_longitude, p_device_model, p_device_os
  );

  RETURN jsonb_build_object('reportId', v_report_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_daily_report(uuid, double precision, double precision, text, text, jsonb) TO anon;

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

  RETURN jsonb_build_object('resolutionRequestId', v_resolution_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_discrepancy_resolution(uuid, uuid, double precision, double precision, text, text, text) TO anon;

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
      'isAutoFiled', dr.is_auto_filed, 'createdAt', dr.created_at, 'resolvedAt', dr.resolved_at,
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
      'latestRequest', (
        SELECT jsonb_build_object('id', x.id, 'status', x.status, 'rejectReason', x.reject_reason, 'createdAt', x.created_at)
        FROM public.discrepancy_resolutions x WHERE x.report_item_id = dri.id
        ORDER BY x.created_at DESC LIMIT 1
      )
    ) AS row_data, dr.report_date AS sort_key
    FROM public.daily_report_items dri
    JOIN public.daily_reports dr ON dr.id = dri.report_id
    WHERE dr.agent_id = p_agent_id AND dri.discrepancy <> 0
    ORDER BY dr.report_date DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_discrepancies(uuid, integer) TO anon;

CREATE OR REPLACE FUNCTION public.get_my_return_requests(p_agent_id uuid, p_limit integer DEFAULT 50)
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
      'resolutionRequestId', dres.id, 'status', dres.status, 'createdAt', dres.created_at,
      'resolvedAt', dres.resolved_at, 'rejectReason', dres.reject_reason,
      'productCode', dri.product_code, 'productName', dri.product_name, 'discrepancy', dri.discrepancy,
      'reportDate', dr.report_date,
      'gps', CASE WHEN g.id IS NOT NULL THEN jsonb_build_object('latitude', g.latitude, 'longitude', g.longitude) ELSE NULL END,
      'media', CASE WHEN m.id IS NOT NULL THEN jsonb_build_object('storagePath', m.storage_path, 'deviceModel', m.device_model, 'deviceOs', m.device_os) ELSE NULL END
    ) AS row_data, dres.created_at AS sort_key
    FROM public.discrepancy_resolutions dres
    JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
    JOIN public.daily_reports dr ON dr.id = dri.report_id
    LEFT JOIN public.gps_coordinates g ON g.id = dres.gps_id
    LEFT JOIN public.media m ON m.id = dres.media_id
    WHERE dres.agent_id = p_agent_id
    ORDER BY dres.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_return_requests(uuid, integer) TO anon;

-- ============================================================
-- 8. Manager-facing RPCs (SECURITY DEFINER, GRANT TO authenticated)
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_daily_report(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.daily_reports;
  v_item RECORD;
  v_effective_return integer;
  v_alloc RECORD;
  v_credit RECORD;
BEGIN
  SELECT * INTO v_report FROM public.daily_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager' AND v_report.branch_id = ANY(branch_ids)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  IF v_report.status <> 'pending' THEN
    RAISE EXCEPTION 'Report is no longer pending (current status: %)', v_report.status;
  END IF;

  CREATE TEMP TABLE _report_credits (batch_number text PRIMARY KEY, credit_qty integer NOT NULL) ON COMMIT DROP;

  FOR v_item IN SELECT * FROM public.daily_report_items WHERE report_id = v_report.id
  LOOP
    v_effective_return := LEAST(v_item.return_quantity, GREATEST(v_item.in_custody_quantity - v_item.sold_quantity, 0));
    IF v_effective_return > 0 THEN
      FOR v_alloc IN SELECT * FROM public._allocate_report_item_batches(v_item.id, v_item.sold_quantity, v_effective_return)
      LOOP
        INSERT INTO _report_credits (batch_number, credit_qty) VALUES (v_alloc.batch_number, v_alloc.quantity)
          ON CONFLICT (batch_number) DO UPDATE SET credit_qty = _report_credits.credit_qty + EXCLUDED.credit_qty;
      END LOOP;
    END IF;
  END LOOP;

  FOR v_credit IN SELECT * FROM _report_credits ORDER BY batch_number
  LOOP
    PERFORM 1 FROM public.branch_inventory WHERE batch_number = v_credit.batch_number FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Batch % no longer exists in branch inventory — cannot credit return', v_credit.batch_number;
    END IF;
    UPDATE public.branch_inventory SET quantity = quantity + v_credit.credit_qty WHERE batch_number = v_credit.batch_number;
  END LOOP;

  UPDATE public.daily_reports SET status = 'accepted', resolved_by = auth.uid(), resolved_at = now() WHERE id = v_report.id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_daily_report(uuid) TO authenticated;

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
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_discrepancy_resolution(uuid, text) TO authenticated;

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
      'agentId', dr.agent_id, 'agentName', ag.full_name, 'branchId', dr.branch_id,
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
    WHERE dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
      AND dri.discrepancy <> 0
    ORDER BY dr.report_date DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_branch_discrepancies(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_branch_return_requests(p_limit integer DEFAULT 100)
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
      'resolutionRequestId', dres.id, 'status', dres.status, 'createdAt', dres.created_at,
      'resolvedAt', dres.resolved_at, 'rejectReason', dres.reject_reason,
      'agentId', dr.agent_id, 'agentName', ag.full_name,
      'productCode', dri.product_code, 'productName', dri.product_name, 'discrepancy', dri.discrepancy,
      'reportDate', dr.report_date,
      'gps', CASE WHEN g.id IS NOT NULL THEN jsonb_build_object('latitude', g.latitude, 'longitude', g.longitude) ELSE NULL END,
      'media', CASE WHEN m.id IS NOT NULL THEN jsonb_build_object('storagePath', m.storage_path, 'deviceModel', m.device_model, 'deviceOs', m.device_os) ELSE NULL END
    ) AS row_data, dres.created_at AS sort_key
    FROM public.discrepancy_resolutions dres
    JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
    JOIN public.daily_reports dr ON dr.id = dri.report_id
    JOIN public.user_profiles ag ON ag.id = dr.agent_id
    LEFT JOIN public.gps_coordinates g ON g.id = dres.gps_id
    LEFT JOIN public.media m ON m.id = dres.media_id
    WHERE dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
    ORDER BY dres.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_branch_return_requests(integer) TO authenticated;

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
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager' AND p_branch_id = ANY(branch_ids)
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
      'loss', COALESCE(p.loss, 0), 'over', COALESCE(p.over, 0)
    ) AS row_data, p.product_code
    FROM (
      SELECT
        dri.product_code,
        (array_agg(dri.product_name ORDER BY dr.created_at DESC))[1] AS product_name,
        SUM(dri.sold_quantity) AS sales,
        SUM(dri.return_quantity) AS returned,
        SUM(GREATEST(-dri.discrepancy, 0)) AS loss,
        SUM(GREATEST(dri.discrepancy, 0)) AS over
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
      WHERE branch_id = p_branch_id AND status = 'accepted' AND report_date BETWEEN p_period_start AND p_period_end
    ),
    'reportsAutoFiled', (
      SELECT COUNT(*) FROM public.daily_reports
      WHERE branch_id = p_branch_id AND is_auto_filed AND report_date BETWEEN p_period_start AND p_period_end
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

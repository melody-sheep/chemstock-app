-- Collector "Accept Deliveries" / "Deliver Stock": a Collector accepts
-- custody of a manager's collector-movement release (reusing the existing
-- accept_stock_release/get_transaction_by_qr_code_for_agent RPCs, unchanged),
-- then groups one or more accepted-but-undelivered transactions into a
-- "trip" (single or batch), starts it, logs event-triggered location
-- checkpoints (Shopee-style, not live GPS), and finishes each leg
-- individually — the trip completes once every leg is delivered.
--
-- Reviewed by the same design-review pass as every prior schema-affecting
-- feature this project. Caught and fixed: a deadlock risk from unordered
-- row-locking on batch trip-starts, a "stuck trip never marked completed"
-- race between two legs finishing concurrently (fixed by always locking the
-- trip row before any leg row, in every RPC that touches trip state), and
-- resolved two open design questions: (1) a cancelled trip's transactions
-- are NOT permanently blacklisted from a future trip — cancel fully
-- detaches still-in-transit legs, keeping only delivered legs' trip_items
-- rows as a permanent audit trail; (2) a partially-finished batch trip CAN
-- be cancelled at any point — delivered legs stay delivered regardless of
-- what happens to the rest of the trip.

-- ============================================================
-- 1. Widen delivery_status; add delivered_at; add checkpoint label
-- ============================================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_delivery_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_delivery_status_check
  CHECK (
    (movement_type = 'direct'    AND delivery_status IS NULL)
    OR
    (movement_type = 'collector' AND delivery_status IN ('not_delivered', 'in_transit', 'delivered'))
  );

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.delivery_checkpoints ADD COLUMN IF NOT EXISTS label text;

-- ============================================================
-- 2. delivery_trips / delivery_trip_items — group N accepted transactions
--    into one collector trip (a single delivery is a trip with one item).
-- ============================================================
CREATE TABLE public.delivery_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id uuid NOT NULL REFERENCES public.user_profiles(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  origin_gps_id uuid REFERENCES public.gps_coordinates(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.delivery_trips (collector_id);
CREATE INDEX ON public.delivery_trips (branch_id);

-- No UNIQUE(transaction_id) — deliberate. A cancelled trip's legs must be
-- able to rejoin a later trip. The "never in two ACTIVE trips at once"
-- invariant is enforced procedurally (lock + status check inside
-- start_delivery_trip), same as every other stock-mutation RPC here, not a
-- table constraint.
CREATE TABLE public.delivery_trip_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.delivery_trips(id),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.delivery_trip_items (trip_id);
CREATE INDEX ON public.delivery_trip_items (transaction_id);

ALTER TABLE public.delivery_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_trip_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view trips for their branches"
  ON public.delivery_trips FOR SELECT TO authenticated
  USING (branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid()));

CREATE POLICY "Managers can view trip items for their branches"
  ON public.delivery_trip_items FOR SELECT TO authenticated
  USING (trip_id IN (
    SELECT id FROM public.delivery_trips
    WHERE branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

-- ============================================================
-- 3. get_my_collector_deliveries — collector-facing, unified list. One
--    RPC, client filters by the computed `stage` field — same shape as
--    get_branch_stock_requests/get_my_stock_requests.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_collector_deliveries(p_agent_id uuid, p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'collector') THEN
    RAISE EXCEPTION 'Invalid collector';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_key DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'transactionId', t.id,
      'qrCode', t.qr_code,
      'createdAt', t.created_at,
      'deliveredAt', t.delivered_at,
      'deliveryStatus', t.delivery_status,
      'stage', CASE
        WHEN NOT EXISTS (SELECT 1 FROM public.stock_acceptances sa WHERE sa.transaction_id = t.id) THEN 'pending_pickup'
        WHEN t.delivery_status = 'not_delivered' THEN 'ready_to_deliver'
        WHEN t.delivery_status = 'in_transit' THEN 'in_transit'
        ELSE 'delivered'
      END,
      'releasedByName', rel.full_name,
      'branchName', br.name,
      'targetRecipientId', t.target_recipient_id,
      'targetRecipientName', tgt.full_name,
      'originGps', CASE WHEN og.id IS NOT NULL THEN jsonb_build_object('latitude', og.latitude, 'longitude', og.longitude) ELSE NULL END,
      'destinationGps', CASE WHEN dg.id IS NOT NULL THEN jsonb_build_object('latitude', dg.latitude, 'longitude', dg.longitude) ELSE NULL END,
      'tripId', dti.trip_id,
      'tripStatus', dt.status,
      'tripOriginGps', CASE WHEN tog.id IS NOT NULL THEN jsonb_build_object('latitude', tog.latitude, 'longitude', tog.longitude) ELSE NULL END,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'productCode', td.product_code, 'productName', td.product_name,
          'batchNumber', td.batch_number, 'quantity', td.quantity
        ) ORDER BY td.created_at)
        FROM public.transaction_details td WHERE td.transaction_id = t.id
      ), '[]'::jsonb),
      'checkpoints', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'latitude', dc.latitude, 'longitude', dc.longitude, 'label', dc.label, 'createdAt', dc.created_at
        ) ORDER BY dc.created_at)
        FROM public.delivery_checkpoints dc WHERE dc.transaction_id = t.id
      ), '[]'::jsonb)
    ) AS row_data,
    t.created_at AS sort_key
    FROM public.transactions t
    JOIN public.branches br ON br.id = t.branch_id
    LEFT JOIN public.user_profiles rel ON rel.id = t.released_by
    LEFT JOIN public.user_profiles tgt ON tgt.id = t.target_recipient_id
    LEFT JOIN public.gps_coordinates og ON og.id = t.gps_id
    LEFT JOIN public.gps_coordinates dg ON dg.id = t.destination_gps_id
    LEFT JOIN public.delivery_trip_items dti ON dti.transaction_id = t.id
    LEFT JOIN public.delivery_trips dt ON dt.id = dti.trip_id
    LEFT JOIN public.gps_coordinates tog ON tog.id = dt.origin_gps_id
    WHERE t.movement_type = 'collector' AND t.received_by = p_agent_id
    ORDER BY t.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_collector_deliveries(uuid, integer) TO anon;

-- ============================================================
-- 4. start_delivery_trip — collector-facing
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

  -- Dedup + canonical (id-ascending) order — so two overlapping batch-start
  -- calls always lock shared rows in the same order and can never deadlock.
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

  RETURN jsonb_build_object('tripId', v_trip_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_delivery_trip(uuid, uuid[], double precision, double precision) TO anon;

-- ============================================================
-- 5. cancel_delivery_trip — collector-facing. Allowed at any point, even
--    mid-batch with some legs already delivered — those stay delivered.
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_delivery_trip(p_agent_id uuid, p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.delivery_trips;
  v_reverted_ids uuid[] := '{}';
  v_row_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'collector') THEN
    RAISE EXCEPTION 'Invalid collector';
  END IF;

  SELECT * INTO v_trip FROM public.delivery_trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found';
  END IF;
  IF v_trip.collector_id <> p_agent_id THEN
    RAISE EXCEPTION 'Not your trip';
  END IF;
  IF v_trip.status <> 'active' THEN
    RAISE EXCEPTION 'Trip is no longer active';
  END IF;

  -- Postgres disallows FOR UPDATE together with an aggregate (array_agg) in
  -- the same query — lock+collect via a cursor loop instead.
  FOR v_row_id IN
    SELECT t.id FROM public.transactions t
    JOIN public.delivery_trip_items dti ON dti.transaction_id = t.id
    WHERE dti.trip_id = v_trip.id AND t.delivery_status = 'in_transit'
    ORDER BY t.id
    FOR UPDATE OF t
  LOOP
    v_reverted_ids := array_append(v_reverted_ids, v_row_id);
  END LOOP;

  IF array_length(v_reverted_ids, 1) > 0 THEN
    UPDATE public.transactions SET delivery_status = 'not_delivered' WHERE id = ANY(v_reverted_ids);
    DELETE FROM public.delivery_trip_items WHERE trip_id = v_trip.id AND transaction_id = ANY(v_reverted_ids);
  END IF;

  UPDATE public.delivery_trips SET status = 'cancelled', cancelled_at = now() WHERE id = v_trip.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_delivery_trip(uuid, uuid) TO anon;

-- ============================================================
-- 6. log_delivery_checkpoint — collector-facing. Fans out one row per
--    currently-in_transit sibling leg, so each transaction's own checkpoint
--    history (already read by the Manager/SR screens) gets the entry with
--    zero changes needed to those screens' data shape.
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_delivery_checkpoint(
  p_agent_id uuid,
  p_trip_id uuid,
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
  v_trip public.delivery_trips;
  v_txn_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'collector') THEN
    RAISE EXCEPTION 'Invalid collector';
  END IF;
  IF p_label IS NULL OR btrim(p_label) = '' THEN
    RAISE EXCEPTION 'A location label is required';
  END IF;

  SELECT * INTO v_trip FROM public.delivery_trips WHERE id = p_trip_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip not found';
  END IF;
  IF v_trip.collector_id <> p_agent_id THEN
    RAISE EXCEPTION 'Not your trip';
  END IF;
  IF v_trip.status <> 'active' THEN
    RAISE EXCEPTION 'Trip is no longer active';
  END IF;

  FOR v_txn_id IN
    SELECT t.id FROM public.transactions t
    JOIN public.delivery_trip_items dti ON dti.transaction_id = t.id
    WHERE dti.trip_id = v_trip.id AND t.delivery_status = 'in_transit'
  LOOP
    INSERT INTO public.delivery_checkpoints (transaction_id, latitude, longitude, label, captured_by)
      VALUES (v_txn_id, p_latitude, p_longitude, p_label, p_agent_id);
  END LOOP;

  RETURN jsonb_build_object('label', p_label, 'latitude', p_latitude, 'longitude', p_longitude);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_delivery_checkpoint(uuid, uuid, double precision, double precision, text) TO anon;

-- ============================================================
-- 7. finish_delivery_leg — collector-facing. Always locks the trip row
--    before the leg row — this ordering is what prevents two legs of the
--    same batch trip finishing concurrently from both missing the "all
--    delivered" completion check.
-- ============================================================
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

  RETURN jsonb_build_object('tripCompleted', v_all_delivered);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_delivery_leg(uuid, uuid, double precision, double precision, text) TO anon;

-- ============================================================
-- 8. get_my_deliveries — add checkpoint label + deliveredAt. Safe to
--    CREATE OR REPLACE: still returns jsonb, argument list unchanged.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_deliveries(p_agent_id uuid, p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role IN ('sales_rep', 'collector')
  ) THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_key DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'transactionId', t.id,
      'createdAt', t.created_at,
      'deliveredAt', t.delivered_at,
      'deliveryStatus', t.delivery_status,
      'collectorName', col.full_name,
      'originGps', CASE WHEN og.id IS NOT NULL
        THEN jsonb_build_object('latitude', og.latitude, 'longitude', og.longitude)
        ELSE NULL END,
      'destinationGps', CASE WHEN dg.id IS NOT NULL
        THEN jsonb_build_object('latitude', dg.latitude, 'longitude', dg.longitude)
        ELSE NULL END,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'productCode', td.product_code, 'productName', td.product_name,
          'batchNumber', td.batch_number, 'quantity', td.quantity
        ) ORDER BY td.created_at)
        FROM public.transaction_details td WHERE td.transaction_id = t.id
      ), '[]'::jsonb),
      'lastCheckpoint', (
        SELECT jsonb_build_object('latitude', dc.latitude, 'longitude', dc.longitude, 'label', dc.label, 'createdAt', dc.created_at)
        FROM public.delivery_checkpoints dc
        WHERE dc.transaction_id = t.id
        ORDER BY dc.created_at DESC
        LIMIT 1
      )
    ) AS row_data,
    t.created_at AS sort_key
    FROM public.transactions t
    LEFT JOIN public.user_profiles col ON col.id = t.received_by
    LEFT JOIN public.gps_coordinates og ON og.id = t.gps_id
    LEFT JOIN public.gps_coordinates dg ON dg.id = t.destination_gps_id
    WHERE t.movement_type = 'collector' AND t.target_recipient_id = p_agent_id
    ORDER BY t.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_deliveries(uuid, integer) TO anon;

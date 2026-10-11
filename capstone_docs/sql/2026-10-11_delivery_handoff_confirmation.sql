-- ============================================================================
-- 2026-10-11_delivery_handoff_confirmation.sql
-- ----------------------------------------------------------------------------
-- Adds SR (Sales Rep) confirmation for collector-mediated deliveries.
--
-- PROBLEM THIS SOLVES:
--   When a manager releases stock via a Collector (movement_type='collector'),
--   the collector accepts at pickup, delivers in person, and marks the leg
--   delivered via finish_delivery_leg. The Sales Rep who physically receives
--   the stock has no way to confirm in the app — the transaction's QR was
--   already consumed by the collector's accept_stock_release. The SR's
--   sr_inventory is never credited for collector-mediated deliveries.
--
-- WHAT THIS ADDS:
--   A new delivery_handoffs table (one row per collector-delivered
--   transaction) tracking the SR's confirm-or-dispute decision. Two new RPCs
--   let the SR confirm or dispute a handoff. finish_delivery_leg is extended
--   to notify the SR when a handoff is waiting on them.
--
-- WHAT THIS DOES NOT TOUCH:
--   * stock_acceptances (has UNIQUE on transaction_id — deliberately NOT
--     reused, since the collector's pickup already wrote a row there)
--   * sr_inventory table structure
--   * transactions table structure
--   * release_stock_batch, accept_stock_release, start_delivery_trip
--   * Any existing RLS policy
--
-- CREDIT TIMING (locked): sr_inventory for the SR is credited only when
--   BOTH the collector's finish_delivery_leg AND the SR's confirm have
--   landed on the server. Prevents phantom stock if the collector's phone
--   stays offline for hours after a physical handoff.
--
-- DISTANCE (locked): warn-only at 300m (matches NEAR_THRESHOLD_METERS in
--   CollectorDeliverStockScreen.js). Recorded, never blocks a real handoff.
--
-- DISPUTE (locked): notify manager only. Collector's delivery_status stays
--   'delivered' — no silent state flip. Manager investigates.
--
-- PHOTO (locked): SR's confirm requires a photo, consistent with every
--   other acceptance flow in the app.
--
-- RUN ORDER: run top to bottom in the Supabase SQL editor as ONE paste.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — delivery_handoffs table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.delivery_handoffs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id       uuid NOT NULL UNIQUE REFERENCES public.transactions(id),
  collector_id         uuid NOT NULL REFERENCES public.user_profiles(id),
  sr_id                uuid NOT NULL REFERENCES public.user_profiles(id),
  collector_claimed_at timestamptz NOT NULL DEFAULT now(),
  sr_confirmed_at      timestamptz,
  gps_id               uuid REFERENCES public.gps_coordinates(id),
  media_id             uuid REFERENCES public.media(id),
  distance_meters      double precision,
  handoff_status       text NOT NULL DEFAULT 'pending_sr'
    CHECK (handoff_status IN ('pending_sr', 'confirmed', 'disputed')),
  dispute_reason       text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_handoffs_sr_pending_idx
  ON public.delivery_handoffs (sr_id, handoff_status, created_at DESC);

CREATE INDEX IF NOT EXISTS delivery_handoffs_collector_idx
  ON public.delivery_handoffs (collector_id, created_at DESC);


-- ============================================================================
-- SECTION 2 — RLS on delivery_handoffs
--   Mirror of stock_acceptances' manager-visibility pattern, scoped to
--   transactions in the manager's branches. Agents (anon) never touch this
--   table directly — only through the SECURITY DEFINER RPCs below.
-- ============================================================================
ALTER TABLE public.delivery_handoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view delivery handoffs for their branches"
  ON public.delivery_handoffs;

CREATE POLICY "Managers can view delivery handoffs for their branches"
  ON public.delivery_handoffs FOR SELECT TO authenticated
  USING (transaction_id IN (
    SELECT id FROM public.transactions
    WHERE branch_id IN (
      SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid()
    )
  ));

-- Same reasoning as stock_acceptances' gps/media policies: the owner-scoped
-- policy (captured_by = auth.uid()) never matches an agent-owned row, so the
-- manager needs their own branch-scoped visibility policy.
DROP POLICY IF EXISTS "Managers can view gps for their branches' delivery handoffs"
  ON public.gps_coordinates;

CREATE POLICY "Managers can view gps for their branches' delivery handoffs"
  ON public.gps_coordinates FOR SELECT TO authenticated
  USING (id IN (
    SELECT dh.gps_id FROM public.delivery_handoffs dh
    JOIN public.transactions t ON t.id = dh.transaction_id
    WHERE dh.gps_id IS NOT NULL
      AND t.branch_id IN (
        SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid()
      )
  ));

DROP POLICY IF EXISTS "Managers can view media for their branches' delivery handoffs"
  ON public.media;

CREATE POLICY "Managers can view media for their branches' delivery handoffs"
  ON public.media FOR SELECT TO authenticated
  USING (id IN (
    SELECT dh.media_id FROM public.delivery_handoffs dh
    JOIN public.transactions t ON t.id = dh.transaction_id
    WHERE dh.media_id IS NOT NULL
      AND t.branch_id IN (
        SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid()
      )
  ));

DROP POLICY IF EXISTS "Managers can view delivery handoff media for their branches"
  ON storage.objects;

CREATE POLICY "Managers can view delivery handoff media for their branches"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shipment-media' AND name IN (
    SELECT m.storage_path FROM public.media m
    JOIN public.delivery_handoffs dh ON dh.media_id = m.id
    JOIN public.transactions t ON t.id = dh.transaction_id
    WHERE t.branch_id IN (
      SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid()
    )
  ));


-- ============================================================================
-- SECTION 3 — Extend notifications.type CHECK constraint
--   3 new types. Full list preserved (7 existing + 3 new = 10 total).
-- ============================================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'stock_request_submitted', 'stock_request_resolved',
    'daily_report_submitted',
    'return_request_submitted', 'return_request_resolved',
    'delivery_assigned', 'delivery_status_update',
    -- New for handoff confirmation:
    'delivery_handoff_pending_sr',    -- fires when collector marks delivered
    'delivery_handoff_confirmed',     -- fires when SR confirms
    'delivery_handoff_disputed'       -- fires when SR disputes
  ));


-- ============================================================================
-- SECTION 4 — sr_inventory INSERT grant for delivery_handoffs path
--   Reuses sr_inventory as-is. The new confirm RPC writes to it directly,
--   but sr_inventory.acceptance_id has a NOT NULL FK to stock_acceptances.
--   So we make acceptance_id nullable and add a new nullable FK to
--   delivery_handoffs for the handoff path.
-- ============================================================================
ALTER TABLE public.sr_inventory
  ALTER COLUMN acceptance_id DROP NOT NULL;

ALTER TABLE public.sr_inventory
  ADD COLUMN IF NOT EXISTS handoff_id uuid REFERENCES public.delivery_handoffs(id);

-- Enforce exactly one of the two sources per row — either it came from a
-- manager QR acceptance OR from a collector handoff, never both, never neither.
ALTER TABLE public.sr_inventory DROP CONSTRAINT IF EXISTS sr_inventory_source_check;

ALTER TABLE public.sr_inventory ADD CONSTRAINT sr_inventory_source_check
  CHECK (
    (acceptance_id IS NOT NULL AND handoff_id IS NULL)
    OR
    (acceptance_id IS NULL AND handoff_id IS NOT NULL)
  );


-- ============================================================================
-- SECTION 5 — sr_inventory.quantity CHECK: allow the handoff path's rows.
--   sr_inventory.quantity is defined with CHECK (quantity > 0). Confirm
--   handoffs insert the same quantity as transaction_details rows, which
--   the schema already requires > 0. No change needed — statement omitted.
-- ============================================================================


-- ============================================================================
-- SECTION 6 — confirm_delivery_handoff RPC
--   SR-side. Idempotent-ish: rejects if already confirmed or disputed.
--   Credits sr_inventory. Computes and stores distance to the collector's
--   last checkpoint (or the transaction's destination_gps_id as fallback).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.confirm_delivery_handoff(
  p_agent_id uuid,
  p_transaction_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_path text,
  p_device_model text,
  p_device_os text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_handoff public.delivery_handoffs;
  v_txn public.transactions;
  v_gps_id uuid;
  v_media_id uuid;
  v_distance double precision;
  v_collector_gps_lat double precision;
  v_collector_gps_lng double precision;
  v_detail public.transaction_details;
  v_total_items integer := 0;
BEGIN
  -- 1. Verify the agent is a Sales Rep (not a collector).
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_agent_id AND role = 'sales_rep'
  ) THEN
    RAISE EXCEPTION 'Invalid Sales Rep';
  END IF;

  -- 2. Load and lock the transaction; verify the SR is the target recipient.
  SELECT * INTO v_txn FROM public.transactions
    WHERE id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_txn.target_recipient_id IS DISTINCT FROM p_agent_id THEN
    RAISE EXCEPTION 'This delivery is not assigned to you';
  END IF;

  IF v_txn.movement_type <> 'collector' THEN
    RAISE EXCEPTION 'This transaction is not a collector delivery';
  END IF;

  -- 3. Load and lock the handoff; verify pending state.
  SELECT * INTO v_handoff FROM public.delivery_handoffs
    WHERE transaction_id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending handoff for this delivery';
  END IF;

  IF v_handoff.handoff_status <> 'pending_sr' THEN
    RAISE EXCEPTION 'This handoff is already %', v_handoff.handoff_status;
  END IF;

  -- 4. Wait-for-collector-sync: the collector's finish_delivery_leg must have
  --    already landed. If not, the SR's confirm cannot credit yet — the
  --    outbox will retry until the collector's side arrives.
  IF v_txn.delivery_status <> 'delivered' THEN
    RAISE EXCEPTION 'Collector has not yet marked this delivery as delivered on the server — retry once their side syncs';
  END IF;

  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'A photo is required to confirm receipt';
  END IF;

  -- 5. Compute distance to the collector's last known GPS. Prefer the latest
  --    delivery_checkpoints row on this transaction; fall back to the
  --    transaction's destination_gps_id if no checkpoints exist yet.
  SELECT dc.latitude, dc.longitude
    INTO v_collector_gps_lat, v_collector_gps_lng
    FROM public.delivery_checkpoints dc
    WHERE dc.transaction_id = p_transaction_id
    ORDER BY dc.captured_at DESC
    LIMIT 1;

  IF v_collector_gps_lat IS NULL THEN
    SELECT g.latitude, g.longitude
      INTO v_collector_gps_lat, v_collector_gps_lng
      FROM public.gps_coordinates g
      WHERE g.id = v_txn.destination_gps_id;
  END IF;

  -- Haversine distance in meters; NULL if either side is missing.
  IF v_collector_gps_lat IS NOT NULL
     AND v_collector_gps_lng IS NOT NULL
     AND p_latitude IS NOT NULL
     AND p_longitude IS NOT NULL THEN
    v_distance := 6371000 * 2 * asin(sqrt(
      power(sin(radians(p_latitude - v_collector_gps_lat) / 2), 2)
      + cos(radians(v_collector_gps_lat))
        * cos(radians(p_latitude))
        * power(sin(radians(p_longitude - v_collector_gps_lng) / 2), 2)
    ));
  END IF;

  -- 6. Insert GPS + media (same pattern as accept_stock_release).
  INSERT INTO public.gps_coordinates (latitude, longitude, captured_by)
    VALUES (p_latitude, p_longitude, p_agent_id)
    RETURNING id INTO v_gps_id;

  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, p_agent_id)
    RETURNING id INTO v_media_id;

  -- 7. Credit SR inventory from transaction_details — the same rows the
  --    branch_inventory ledger and the SR's eventual daily report will
  --    reference. handoff_id ties these back to the handoff confirmation.
  FOR v_detail IN
    SELECT * FROM public.transaction_details WHERE transaction_id = v_txn.id
  LOOP
    INSERT INTO public.sr_inventory
      (acceptance_id, handoff_id, transaction_id, sr_id,
       product_code, product_name, batch_number, mfg_date, exp_date,
       quantity, remaining_quantity)
      VALUES
      (NULL, v_handoff.id, v_txn.id, p_agent_id,
       v_detail.product_code, v_detail.product_name, v_detail.batch_number,
       v_detail.mfg_date, v_detail.exp_date,
       v_detail.quantity, v_detail.quantity);
    v_total_items := v_total_items + 1;
  END LOOP;

  -- 8. Stamp the handoff as confirmed.
  UPDATE public.delivery_handoffs
    SET handoff_status = 'confirmed',
        sr_confirmed_at = now(),
        gps_id = v_gps_id,
        media_id = v_media_id,
        distance_meters = v_distance
    WHERE id = v_handoff.id;

  -- 9. Notify the collector that the SR confirmed.
  PERFORM public._notify(
    v_handoff.collector_id,
    'delivery_handoff_confirmed',
    'Handoff confirmed',
    'The Sales Rep confirmed receipt of the delivery.',
    'CollectorDeliveredStock',
    jsonb_build_object('transactionId', v_txn.id)
  );

  RETURN jsonb_build_object(
    'handoffId', v_handoff.id,
    'transactionId', v_txn.id,
    'itemsCredited', v_total_items,
    'distanceMeters', v_distance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_delivery_handoff(
  uuid, uuid, double precision, double precision, text, text, text
) TO anon;


-- ============================================================================
-- SECTION 7 — dispute_delivery_handoff RPC
--   SR-side. Records a dispute, notifies the manager, does NOT revert the
--   collector's delivery_status. Does NOT credit sr_inventory.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.dispute_delivery_handoff(
  p_agent_id uuid,
  p_transaction_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_handoff public.delivery_handoffs;
  v_txn public.transactions;
  v_branch_id uuid;
  v_sr_name text;
  v_manager_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_agent_id AND role = 'sales_rep'
  ) THEN
    RAISE EXCEPTION 'Invalid Sales Rep';
  END IF;

  SELECT * INTO v_txn FROM public.transactions
    WHERE id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_txn.target_recipient_id IS DISTINCT FROM p_agent_id THEN
    RAISE EXCEPTION 'This delivery is not assigned to you';
  END IF;

  SELECT * INTO v_handoff FROM public.delivery_handoffs
    WHERE transaction_id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending handoff for this delivery';
  END IF;

  IF v_handoff.handoff_status <> 'pending_sr' THEN
    RAISE EXCEPTION 'This handoff is already %', v_handoff.handoff_status;
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required to dispute a handoff';
  END IF;

  UPDATE public.delivery_handoffs
    SET handoff_status = 'disputed',
        dispute_reason = p_reason
    WHERE id = v_handoff.id;

  v_branch_id := v_txn.branch_id;
  SELECT full_name INTO v_sr_name FROM public.user_profiles WHERE id = p_agent_id;

  FOR v_manager_id IN
    SELECT id FROM public.user_profiles
    WHERE role = 'manager' AND v_branch_id = ANY(branch_ids)
  LOOP
    PERFORM public._notify(
      v_manager_id,
      'delivery_handoff_disputed',
      'Delivery disputed',
      COALESCE(v_sr_name, 'A Sales Rep') || ' disputed a collector handoff: ' || p_reason,
      'TrackDeliveries',
      jsonb_build_object('transactionId', v_txn.id)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'handoffId', v_handoff.id,
    'transactionId', v_txn.id,
    'status', 'disputed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispute_delivery_handoff(
  uuid, uuid, text
) TO anon;


-- ============================================================================
-- SECTION 8 — Extend finish_delivery_leg to create the handoff row +
--   notify the SR. Full body reproduced (CREATE OR REPLACE needs it),
--   matching the current body from 2026-10-06c_notifications_system.sql.
--   Only the block right before RETURN is new.
-- ============================================================================
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

  -- NEW BLOCK: create the handoff row and notify the SR that a confirmation
  -- is now waiting on them. Only fires for collector-path transactions that
  -- have a target recipient set (which release_stock_batch guarantees).
  IF v_txn.target_recipient_id IS NOT NULL THEN
    INSERT INTO public.delivery_handoffs
      (transaction_id, collector_id, sr_id, collector_claimed_at, handoff_status)
      VALUES
      (v_txn.id, p_agent_id, v_txn.target_recipient_id, now(), 'pending_sr')
      ON CONFLICT (transaction_id) DO NOTHING;

    PERFORM public._notify(
      v_txn.target_recipient_id,
      'delivery_handoff_pending_sr',
      'Confirm delivery handoff',
      'A collector just handed you a delivery — confirm receipt in the app.',
      'SalesRepTrackDeliveries',
      jsonb_build_object('transactionId', v_txn.id)
    );
  END IF;

  RETURN jsonb_build_object('tripCompleted', v_all_delivered);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_delivery_leg(
  uuid, uuid, double precision, double precision, text
) TO anon;


-- ============================================================================
-- SECTION 9 — Refresh PostgREST schema cache
--   New tables + new RPCs are not visible to the client until this runs.
-- ============================================================================
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- After running this file, run 2026-10-11_delivery_handoff_confirmation_VALIDATE.sql
-- to confirm everything landed correctly.
-- ============================================================================

-- 2026-10-08_delivery_checkpoint_captured_at.sql
-- Adds a real "when this happened" capture timestamp to delivery_checkpoints,
-- separate from created_at (row-insert time) — matching the convention
-- gps_coordinates/media already use. Needed before checkpoints can safely be
-- queued in the offline outbox: a checkpoint captured offline and synced
-- later must keep the device's original capture time, not the sync time.
-- See Alther_TODO_October.md, PM Priority Check-In, item A (Tier 3,
-- Collector GPS checkpoints) for the full reasoning.
--
-- Reconstructed from the exact live definition in
-- 2026-08-25_collector_delivery_trips.sql (§6, log_delivery_checkpoint) —
-- confirmed via 2026-10-06c_notifications_system.sql's own comment that
-- this function was deliberately left untouched since, so that file is the
-- authoritative current body.
--
-- Run this whole file in the Supabase SQL editor, top to bottom, in order.

-- ============================================================
-- 1. New column. Backfilled from created_at for existing rows (accurate for
--    all of them, since every checkpoint so far was logged online — the
--    discrepancy only starts mattering once offline queuing exists), then
--    defaulted + required for everything from here on.
-- ============================================================
ALTER TABLE public.delivery_checkpoints
  ADD COLUMN captured_at timestamp with time zone;

UPDATE public.delivery_checkpoints
  SET captured_at = created_at
  WHERE captured_at IS NULL;

ALTER TABLE public.delivery_checkpoints
  ALTER COLUMN captured_at SET DEFAULT now(),
  ALTER COLUMN captured_at SET NOT NULL;

-- ============================================================
-- 2. log_delivery_checkpoint gains an optional p_captured_at param (defaults
--    to now() so today's online-only client call keeps working unchanged
--    until the app is updated to send it). Adding a parameter changes the
--    function's signature, so CREATE OR REPLACE alone would leave the old
--    5-arg version behind as a separate overload (same gotcha this project
--    already hit on 2026-08-19 — drop the old signature explicitly first).
-- ============================================================
DROP FUNCTION IF EXISTS public.log_delivery_checkpoint(uuid, uuid, double precision, double precision, text);

CREATE OR REPLACE FUNCTION public.log_delivery_checkpoint(
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
  v_trip public.delivery_trips;
  v_txn_id uuid;
  v_captured_at timestamp with time zone := COALESCE(p_captured_at, now());
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
    INSERT INTO public.delivery_checkpoints (transaction_id, latitude, longitude, label, captured_by, captured_at)
      VALUES (v_txn_id, p_latitude, p_longitude, p_label, p_agent_id, v_captured_at);
  END LOOP;

  RETURN jsonb_build_object('label', p_label, 'latitude', p_latitude, 'longitude', p_longitude, 'capturedAt', v_captured_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_delivery_checkpoint(uuid, uuid, double precision, double precision, text, timestamp with time zone) TO anon;

-- ============================================================
-- 3. Sanity check after running the above — confirm the old 5-arg overload
--    is really gone and only the 6-arg version exists.
-- ============================================================
-- SELECT proname, pronargs FROM pg_proc WHERE proname = 'log_delivery_checkpoint';

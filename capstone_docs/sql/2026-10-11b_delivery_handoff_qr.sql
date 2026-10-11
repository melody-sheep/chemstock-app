-- ============================================================================
-- 2026-10-11b_delivery_handoff_qr.sql
-- ----------------------------------------------------------------------------
-- Second migration for the delivery-handoff feature. Adds the QR-scan
-- validation layer on top of the delivery_handoffs table created by
-- 2026-10-11_delivery_handoff_confirmation.sql.
--
-- WHY THIS EXISTS:
--   The first migration created the confirm_delivery_handoff RPC, but it
--   accepted the SR's confirmation on a tap alone. The final design requires
--   the SR to SCAN the same physical QR the Manager generated (the one
--   already printed on the package, which the Collector scanned at pickup).
--   This proves the SR is physically holding the package, not just
--   confirming remotely.
--
-- WHAT THIS ADDS:
--   1. delivery_handoffs.sr_scanned_qr_code      (the string the SR scanned)
--   2. delivery_handoffs.sr_photo_is_damage_report (flag if the SR's photo
--      is a damage-report rather than a normal confirm photo)
--   3. Rewritten confirm_delivery_handoff with p_scanned_qr_code param
--      + QR-match validation + distance computation (unchanged) + all
--      previous behavior preserved.
--   4. New get_my_pending_handoffs read RPC for the SR's pending list.
--   5. Extended dispute_delivery_handoff: reason enum (damaged_qr,
--      missing_qr, wrong_items, not_received, other) + optional photo.
--   6. Supporting index for SR-side pending lookups.
--
-- WHAT THIS DOES NOT TOUCH:
--   * stock_acceptances (UNIQUE on transaction_id preserved)
--   * transactions table structure
--   * release_stock_batch, accept_stock_release, start_delivery_trip,
--     log_delivery_checkpoint, finish_delivery_leg (all unchanged from
--     migration 2026-10-11)
--   * Any existing RLS policy
--   * sr_inventory columns or constraints
--
-- RUN IN SUPABASE SQL EDITOR: paste each section separately if the editor
-- truncates long function bodies (dollar-quoted strings can be finicky).
-- ============================================================================


-- ============================================================================
-- SECTION 1 — delivery_handoffs: new columns + index
-- ============================================================================
ALTER TABLE public.delivery_handoffs
  ADD COLUMN IF NOT EXISTS sr_scanned_qr_code text,
  ADD COLUMN IF NOT EXISTS sr_photo_is_damage_report boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS delivery_handoffs_sr_status_created_idx
  ON public.delivery_handoffs (sr_id, handoff_status, created_at DESC);


-- ============================================================================
-- SECTION 2 — confirm_delivery_handoff (rewritten with QR validation)
--   New param: p_scanned_qr_code text DEFAULT NULL
--   New block: reject if scanned QR doesn't match transactions.qr_code
--   Everything else preserved from 2026-10-11 version.
-- ============================================================================
-- PostgreSQL cannot replace a function after its input signature changes.
-- Drop the original signature so the defaulted argument cannot create an
-- ambiguous overload for callers that omit p_scanned_qr_code.
DROP FUNCTION IF EXISTS public.confirm_delivery_handoff(
  uuid, uuid, double precision, double precision, text, text, text
);

CREATE OR REPLACE FUNCTION public.confirm_delivery_handoff(
  p_agent_id uuid,
  p_transaction_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_path text,
  p_device_model text,
  p_device_os text,
  p_scanned_qr_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $func$
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

  IF v_txn.movement_type <> 'collector' THEN
    RAISE EXCEPTION 'This transaction is not a collector delivery';
  END IF;

  IF p_scanned_qr_code IS NULL OR btrim(p_scanned_qr_code) = '' THEN
    RAISE EXCEPTION 'A QR scan is required to confirm receipt';
  END IF;

  IF v_txn.qr_code IS DISTINCT FROM p_scanned_qr_code THEN
    RAISE EXCEPTION 'The scanned QR does not match this delivery — check you are scanning the correct package';
  END IF;

  SELECT * INTO v_handoff FROM public.delivery_handoffs
    WHERE transaction_id = p_transaction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending handoff for this delivery';
  END IF;

  IF v_handoff.handoff_status <> 'pending_sr' THEN
    RAISE EXCEPTION 'This handoff is already %', v_handoff.handoff_status;
  END IF;

  IF v_txn.delivery_status <> 'delivered' THEN
    RAISE EXCEPTION 'Collector has not yet marked this delivery as delivered on the server — retry once their side syncs';
  END IF;

  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'A photo is required to confirm receipt';
  END IF;

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

  INSERT INTO public.gps_coordinates (latitude, longitude, captured_by)
    VALUES (p_latitude, p_longitude, p_agent_id)
    RETURNING id INTO v_gps_id;

  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, p_agent_id)
    RETURNING id INTO v_media_id;

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

  UPDATE public.delivery_handoffs
    SET handoff_status = 'confirmed',
        sr_confirmed_at = now(),
        gps_id = v_gps_id,
        media_id = v_media_id,
        distance_meters = v_distance,
        sr_scanned_qr_code = p_scanned_qr_code,
        sr_photo_is_damage_report = false
    WHERE id = v_handoff.id;

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
$func$;

GRANT EXECUTE ON FUNCTION public.confirm_delivery_handoff(
  uuid, uuid, double precision, double precision, text, text, text, text
) TO anon;


-- ============================================================================
-- SECTION 3 — get_my_pending_handoffs (read RPC for the SR's pending list)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_pending_handoffs(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_agent_id AND role = 'sales_rep'
  ) THEN
    RAISE EXCEPTION 'Invalid Sales Rep';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_key DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      jsonb_build_object(
        'handoffId',          dh.id,
        'transactionId',      dh.transaction_id,
        'handoffStatus',      dh.handoff_status,
        'collectorClaimedAt', dh.collector_claimed_at,
        'collectorId',        dh.collector_id,
        'collectorName',      c.full_name,
        'collectorPhotoPath', c.profile_media_id,
        'collectorGps', CASE WHEN cg.latitude IS NOT NULL
          THEN jsonb_build_object('latitude', cg.latitude, 'longitude', cg.longitude)
          ELSE NULL END,
        'collectorLastSeenAt', c.last_seen_at,
        'branchId',           t.branch_id,
        'branchName',         b.name,
        'releaseQrCode',      t.qr_code,
        'deliveryStatus',     t.delivery_status,
        'deliveredAt',        t.delivered_at,
        'items', COALESCE(
          (SELECT jsonb_agg(jsonb_build_object(
              'productCode',  td.product_code,
              'productName',  td.product_name,
              'batchNumber',  td.batch_number,
              'quantity',     td.quantity,
              'mfgDate',      td.mfg_date,
              'expDate',      td.exp_date
            ) ORDER BY td.created_at)
           FROM public.transaction_details td WHERE td.transaction_id = t.id),
          '[]'::jsonb
        )
      ) AS row_data,
      dh.collector_claimed_at AS sort_key
    FROM public.delivery_handoffs dh
    JOIN public.transactions t ON t.id = dh.transaction_id
    JOIN public.branches b     ON b.id = t.branch_id
    LEFT JOIN public.user_profiles c ON c.id = dh.collector_id
    LEFT JOIN LATERAL (
      SELECT dc.latitude, dc.longitude
      FROM public.delivery_checkpoints dc
      WHERE dc.transaction_id = t.id
      ORDER BY dc.captured_at DESC
      LIMIT 1
    ) cg ON TRUE
    WHERE dh.sr_id = p_agent_id
      AND dh.handoff_status = 'pending_sr'
    ORDER BY dh.collector_claimed_at DESC
  ) sub;

  RETURN v_result;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_handoffs(uuid) TO anon;


-- ============================================================================
-- SECTION 4 — dispute_delivery_handoff (extended with reason enum + photo)
-- ============================================================================
-- Replace the original signature to avoid an ambiguous 3-argument overload
-- beside this function's defaulted optional parameters.
DROP FUNCTION IF EXISTS public.dispute_delivery_handoff(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.dispute_delivery_handoff(
  p_agent_id uuid,
  p_transaction_id uuid,
  p_reason text,
  p_reason_code text DEFAULT NULL,
  p_storage_path text DEFAULT NULL,
  p_device_model text DEFAULT NULL,
  p_device_os text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_handoff public.delivery_handoffs;
  v_txn public.transactions;
  v_branch_id uuid;
  v_sr_name text;
  v_manager_id uuid;
  v_media_id uuid;
  v_valid_codes text[] := ARRAY[
    'damaged_qr', 'missing_qr', 'wrong_items', 'not_received', 'other'
  ];
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

  IF p_reason_code IS NOT NULL AND NOT (p_reason_code = ANY(v_valid_codes)) THEN
    RAISE EXCEPTION 'Invalid dispute reason code: %', p_reason_code;
  END IF;

  IF p_storage_path IS NOT NULL AND btrim(p_storage_path) <> '' THEN
    INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
      VALUES (p_storage_path, p_device_model, p_device_os, p_agent_id)
      RETURNING id INTO v_media_id;
  END IF;

  UPDATE public.delivery_handoffs
    SET handoff_status = 'disputed',
        dispute_reason = CASE
          WHEN p_reason_code IS NOT NULL THEN p_reason_code || ': ' || p_reason
          ELSE p_reason
        END,
        media_id = COALESCE(v_media_id, media_id),
        sr_photo_is_damage_report = (v_media_id IS NOT NULL)
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
      COALESCE(v_sr_name, 'A Sales Rep') || ' reported an issue: ' || p_reason,
      'TrackDeliveries',
      jsonb_build_object('transactionId', v_txn.id)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'handoffId', v_handoff.id,
    'transactionId', v_txn.id,
    'status', 'disputed',
    'reasonCode', p_reason_code
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.dispute_delivery_handoff(
  uuid, uuid, text, text, text, text, text
) TO anon;


-- ============================================================================
-- SECTION 5 — Refresh PostgREST
-- ============================================================================
NOTIFY pgrst, 'reload schema';

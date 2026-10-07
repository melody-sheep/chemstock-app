-- 2026-10-08b_delivery_checkpoint_read_paths.sql
-- Follow-up to 2026-10-08_delivery_checkpoint_captured_at.sql: that file
-- added delivery_checkpoints.captured_at and the write path
-- (log_delivery_checkpoint). This file fixes every READ path that still
-- exposed the checkpoint's created_at (row-insert time) as 'createdAt' to
-- the client — found by grepping every SQL file for "'createdAt'" near
-- delivery_checkpoints, not just the one function already fixed. Without
-- this, a checkpoint captured offline would be written with the right
-- time (previous file) but still displayed/sorted by the wrong time
-- (this file) — the fix would be invisible end to end.
--
-- Exactly 2 functions read delivery_checkpoints and both need this:
--   - get_my_deliveries        — Manager + Sales Rep (list + detail; the
--                                detail screens reuse the object the list
--                                already fetched, passed via nav params)
--   - get_my_collector_deliveries — Collector
-- Both reconstructed from their latest live bodies (get_my_deliveries last
-- patched in 2026-08-25_collector_delivery_trips.sql; get_my_collector_
-- deliveries last patched in 2026-08-28_photos_in_lists.sql — confirmed by
-- checking every later-dated SQL file for another CREATE OR REPLACE of
-- either name, and finding none). Neither function's argument list or
-- return type changes, so CREATE OR REPLACE alone is safe here — no DROP
-- needed (unlike the previous file's log_delivery_checkpoint, which did
-- change argument count).
--
-- Only the two dc.created_at references in each function change, to
-- dc.captured_at. Every other line is identical to the live version.

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
        SELECT jsonb_build_object('latitude', dc.latitude, 'longitude', dc.longitude, 'label', dc.label, 'createdAt', dc.captured_at)
        FROM public.delivery_checkpoints dc
        WHERE dc.transaction_id = t.id
        ORDER BY dc.captured_at DESC
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
      'releasedById', t.released_by,
      'releasedByName', rel.full_name,
      'releasedByPhotoPath', relm.storage_path,
      'branchName', br.name,
      'targetRecipientId', t.target_recipient_id,
      'targetRecipientName', tgt.full_name,
      'targetRecipientPhotoPath', tgtm.storage_path,
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
          'latitude', dc.latitude, 'longitude', dc.longitude, 'label', dc.label, 'createdAt', dc.captured_at
        ) ORDER BY dc.captured_at)
        FROM public.delivery_checkpoints dc WHERE dc.transaction_id = t.id
      ), '[]'::jsonb)
    ) AS row_data,
    t.created_at AS sort_key
    FROM public.transactions t
    JOIN public.branches br ON br.id = t.branch_id
    LEFT JOIN public.user_profiles rel ON rel.id = t.released_by
    LEFT JOIN public.media relm ON relm.id = rel.profile_media_id
    LEFT JOIN public.user_profiles tgt ON tgt.id = t.target_recipient_id
    LEFT JOIN public.media tgtm ON tgtm.id = tgt.profile_media_id
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

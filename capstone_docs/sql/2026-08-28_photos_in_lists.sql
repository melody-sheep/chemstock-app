-- Real profile photos (with initials fallback) in list screens that show
-- someone other than the logged-in user: Manage Accounts, Release Stock
-- recipient picker/confirm, Reports & Returns, Alerts, and the collector
-- delivery screens / Receive Stock's "source" row.
-- Run in Supabase SQL editor.

-- ============================================================
-- 1. get_my_agent_accounts() — adds profile_photo_path so the manager's
--    agent roster (already fetched by Manage Accounts, the Release Stock
--    recipient picker, and now also by Reports & Returns / Alerts to build
--    an agentId -> photo lookup) carries each agent's current photo.
--    DROP FUNCTION is required first: CREATE OR REPLACE cannot change a
--    function's output columns.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_my_agent_accounts();

CREATE FUNCTION public.get_my_agent_accounts()
RETURNS TABLE (
  id uuid,
  username character varying,
  full_name character varying,
  role text,
  branch_ids uuid[],
  created_at timestamptz,
  profile_photo_path text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.username, up.full_name, up.role, up.branch_ids, up.created_at, m.storage_path
  FROM public.user_profiles up
  LEFT JOIN public.media m ON m.id = up.profile_media_id
  WHERE up.created_by = auth.uid()
  ORDER BY up.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_agent_accounts() TO authenticated;

-- ============================================================
-- 2. get_my_collector_deliveries — adds releasedById (the join already
--    existed for the name, the id just wasn't selected) plus both parties'
--    photo paths, for CollectorDeliveryDetailScreen/CollectorTripReview/
--    CollectorAcceptDeliveries. Safe CREATE OR REPLACE: RETURNS jsonb and
--    the argument list are both unchanged.
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
          'latitude', dc.latitude, 'longitude', dc.longitude, 'label', dc.label, 'createdAt', dc.created_at
        ) ORDER BY dc.created_at)
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

-- ============================================================
-- 3. get_transaction_by_qr_code_for_agent — adds releasedById (missing
--    before, only the name was selected) plus receivedBy/releasedBy photo
--    paths, for ReceiveStockSR's "source" row. Safe CREATE OR REPLACE:
--    RETURNS jsonb and the argument list are both unchanged.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_transaction_by_qr_code_for_agent(
  p_qr_code text,
  p_agent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_agent_id AND role IN ('sales_rep', 'collector')
  ) THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  SELECT jsonb_build_object(
    'transactionId', t.id,
    'branchId', t.branch_id,
    'qrCode', t.qr_code,
    'movementType', t.movement_type,
    'receivedBy', t.received_by,
    'receivedByName', rcv.full_name,
    'receivedByPhotoPath', rcvm.storage_path,
    'targetRecipientId', t.target_recipient_id,
    'targetRecipientName', tgt.full_name,
    'releasedById', t.released_by,
    'releasedByName', rel.full_name,
    'releasedByPhotoPath', relm.storage_path,
    'branchName', br.name,
    'alreadyAccepted', EXISTS (
      SELECT 1 FROM public.stock_acceptances sa WHERE sa.transaction_id = t.id
    ),
    'items', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'productCode', td.product_code, 'productName', td.product_name,
          'batchNumber', td.batch_number, 'quantity', td.quantity,
          'mfgDate', td.mfg_date, 'expDate', td.exp_date
        ) ORDER BY td.created_at)
       FROM public.transaction_details td WHERE td.transaction_id = t.id),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.transactions t
  JOIN public.branches br ON br.id = t.branch_id
  LEFT JOIN public.user_profiles rcv ON rcv.id = t.received_by
  LEFT JOIN public.media rcvm ON rcvm.id = rcv.profile_media_id
  LEFT JOIN public.user_profiles tgt ON tgt.id = t.target_recipient_id
  LEFT JOIN public.user_profiles rel ON rel.id = t.released_by
  LEFT JOIN public.media relm ON relm.id = rel.profile_media_id
  WHERE t.qr_code = p_qr_code
    AND (t.received_by = p_agent_id OR t.target_recipient_id = p_agent_id);

  IF v_result IS NULL THEN
    -- Same message whether the QR doesn't exist or just isn't this agent's.
    RAISE EXCEPTION 'Transaction not found or not assigned to you';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_transaction_by_qr_code_for_agent(text, uuid) TO anon;

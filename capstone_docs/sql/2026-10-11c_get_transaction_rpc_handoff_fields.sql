-- ============================================================================
-- 2026-10-11c_get_transaction_rpc_handoff_fields.sql
-- ----------------------------------------------------------------------------
-- Extends get_transaction_by_qr_code_for_agent's return shape with the
-- handoff fields the SR client needs to route a scanned QR correctly:
--   - Collector handoff pending → route to SalesRepConfirmHandoff
--   - Collector handoff already confirmed/disputed → alert
--   - Direct release pending → route to SalesRepConfirmHandoff (direct mode)
--   - Direct release already accepted → alert
--
-- Same signature, same SECURITY DEFINER validation. Only the returned
-- jsonb gains fields; no schema change, no new tables.
--
-- Extracted from: query run in Supabase SQL editor during Checkpoint 1 of
-- the SR receive flow unification session.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_transaction_by_qr_code_for_agent(
  p_qr_code text,
  p_agent_id uuid
)
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
    ),
    -- NEW: handoff fields (only populated for collector-mediated deliveries)
    'handoffId',          dh.id,
    'handoffStatus',      dh.handoff_status,
    'collectorClaimedAt', dh.collector_claimed_at,
    'collectorId',        dh.collector_id,
    'collectorName',      col.full_name,
    'collectorGps', CASE WHEN cg.id IS NOT NULL
      THEN jsonb_build_object('latitude', cg.latitude, 'longitude', cg.longitude)
      ELSE NULL END,
    'isHandoffPending',   (dh.handoff_status = 'pending_sr')
  )
  INTO v_result
  FROM public.transactions t
  JOIN public.branches br ON br.id = t.branch_id
  LEFT JOIN public.user_profiles rcv ON rcv.id = t.received_by
  LEFT JOIN public.media rcvm ON rcvm.id = rcv.profile_media_id
  LEFT JOIN public.user_profiles tgt ON tgt.id = t.target_recipient_id
  LEFT JOIN public.user_profiles rel ON rel.id = t.released_by
  LEFT JOIN public.media relm ON relm.id = rel.profile_media_id
  LEFT JOIN public.delivery_handoffs dh ON dh.transaction_id = t.id
  LEFT JOIN public.user_profiles col ON col.id = dh.collector_id
  LEFT JOIN public.gps_coordinates cg ON cg.id = t.destination_gps_id
  WHERE t.qr_code = p_qr_code
    AND (t.received_by = p_agent_id OR t.target_recipient_id = p_agent_id);

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Transaction not found or not assigned to you';
  END IF;

  RETURN v_result;
END;
$func$;

NOTIFY pgrst, 'reload schema';

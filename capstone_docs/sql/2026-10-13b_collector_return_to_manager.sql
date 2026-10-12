-- Run in the Supabase SQL editor, top to bottom.
--
-- New feature: once a Collector has accepted stock from a Manager and is in
-- the "Ready to Deliver" phase (accepted, not yet started a delivery trip),
-- they can instead return that item to the Manager. A QR is generated for
-- the return; it is only ever looked up by confirm_collector_return, which
-- the Manager's Receive Stock screen calls — so it is not scannable by any
-- Sales Rep flow (those only ever look up transactions.qr_code via
-- get_transaction_by_qr_code_for_agent / accept_stock_release /
-- confirm_delivery_handoff, none of which touch this new table).
--
-- Scope, deliberately narrow: only a transaction that is accepted from the
-- manager but not yet in an active trip (delivery_status = 'not_delivered')
-- can be returned. A trip already in progress is out of scope here — the
-- existing Cancel Delivery flow on CollectorDeliverStockScreen already
-- covers reverting an in-transit leg back to 'not_delivered', at which
-- point this same return flow becomes available for it again.

-- ============================================================
-- 1. collector_returns
-- ============================================================
CREATE TABLE public.collector_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  collector_id uuid NOT NULL REFERENCES public.user_profiles(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  qr_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
  received_by uuid REFERENCES public.user_profiles(id),
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.collector_returns (collector_id);
CREATE INDEX ON public.collector_returns (branch_id);

-- Only one pending return per transaction at a time — prevents the same
-- item being queued for return twice while the first is still unconfirmed.
CREATE UNIQUE INDEX collector_returns_one_pending_per_txn
  ON public.collector_returns (transaction_id) WHERE status = 'pending';

ALTER TABLE public.collector_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view collector returns for their branches"
  ON public.collector_returns FOR SELECT TO authenticated
  USING (branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid()));

-- ============================================================
-- 2. Widen transactions.delivery_status — add 'returning' (a return has
--    been initiated, awaiting the manager's scan) and 'returned' (confirmed
--    received back). Only reachable for movement_type = 'collector', same
--    shape as the existing constraint.
-- ============================================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_delivery_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_delivery_status_check
  CHECK (
    (movement_type = 'direct'    AND delivery_status IS NULL)
    OR
    (movement_type = 'collector' AND delivery_status IN ('not_delivered', 'returning', 'returned', 'in_transit', 'delivered'))
  );

-- ============================================================
-- 3. initiate_collector_return — collector-facing (agent, always anon).
-- ============================================================
CREATE OR REPLACE FUNCTION public.initiate_collector_return(
  p_agent_id uuid,
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
-- `extensions` is required: gen_random_bytes() lives there on Supabase.
-- Without it: "function gen_random_bytes(integer) does not exist" (seen on
-- device Oct 13; corrected live by 2026-10-13c_collector_return_search_path.sql).
SET search_path = public, extensions
AS $$
DECLARE
  v_txn public.transactions;
  v_qr_code text;
  v_return_id uuid;
  v_manager_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role = 'collector') THEN
    RAISE EXCEPTION 'Invalid collector';
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;
  IF v_txn.received_by <> p_agent_id OR v_txn.movement_type <> 'collector' THEN
    RAISE EXCEPTION 'This delivery is not assigned to you';
  END IF;
  IF v_txn.delivery_status <> 'not_delivered' THEN
    RAISE EXCEPTION 'This item is no longer ready to return (status: %)', v_txn.delivery_status;
  END IF;
  IF EXISTS (SELECT 1 FROM public.collector_returns WHERE transaction_id = p_transaction_id AND status = 'pending') THEN
    RAISE EXCEPTION 'A return for this item is already pending';
  END IF;

  v_qr_code := 'RET-' || encode(gen_random_bytes(12), 'hex');

  INSERT INTO public.collector_returns (transaction_id, collector_id, branch_id, qr_code)
    VALUES (p_transaction_id, p_agent_id, v_txn.branch_id, v_qr_code)
    RETURNING id INTO v_return_id;

  UPDATE public.transactions SET delivery_status = 'returning' WHERE id = p_transaction_id;

  FOR v_manager_id IN
    SELECT id FROM public.user_profiles WHERE role = 'manager' AND v_txn.branch_id = ANY(branch_ids)
  LOOP
    PERFORM public._notify(
      v_manager_id,
      'collector_return_initiated',
      'Collector Return Pending',
      'A collector is returning an item to this branch — scan their QR in Receive Stock to confirm.',
      'ReceiveStock'
    );
  END LOOP;

  RETURN jsonb_build_object('returnId', v_return_id, 'qrCode', v_qr_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.initiate_collector_return(uuid, uuid) TO anon;

-- ============================================================
-- 4. confirm_collector_return — manager-facing (always real auth.uid()).
--    Called from the Manager's Receive Stock "Scan QR" action.
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_collector_return(p_qr_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_return public.collector_returns;
  v_txn public.transactions;
  v_items jsonb;
BEGIN
  SELECT * INTO v_return FROM public.collector_returns WHERE qr_code = p_qr_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR code not recognized';
  END IF;
  IF v_return.status <> 'pending' THEN
    RAISE EXCEPTION 'This return was already received';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager' AND v_return.branch_id = ANY(branch_ids)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = v_return.transaction_id FOR UPDATE;
  IF v_txn.delivery_status <> 'returning' THEN
    RAISE EXCEPTION 'This item is not awaiting return (status: %)', v_txn.delivery_status;
  END IF;

  -- Credit every line item back to live branch stock.
  UPDATE public.branch_inventory bi
    SET quantity = bi.quantity + td.quantity
    FROM public.transaction_details td
    WHERE td.transaction_id = v_txn.id AND td.branch_inventory_id = bi.id;

  UPDATE public.transactions SET delivery_status = 'returned' WHERE id = v_txn.id;
  UPDATE public.collector_returns
    SET status = 'received', received_by = auth.uid(), received_at = now()
    WHERE id = v_return.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'productCode', td.product_code, 'productName', td.product_name, 'quantity', td.quantity
  )), '[]'::jsonb)
  INTO v_items
  FROM public.transaction_details td WHERE td.transaction_id = v_txn.id;

  PERFORM public._notify(
    v_return.collector_id,
    'collector_return_received',
    'Return Confirmed',
    'Your manager confirmed the returned stock — it has been credited back to branch inventory.',
    'CollectorDashboard'
  );

  RETURN jsonb_build_object('items', v_items, 'transactionId', v_txn.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_collector_return(text) TO authenticated;

-- ============================================================
-- 5. get_my_collector_deliveries — add the 'returning' stage + QR, so a
--    pending return drops out of "Ready to Deliver" and shows in its own
--    section instead. Same signature — safe CREATE OR REPLACE.
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
        WHEN t.delivery_status = 'returning' THEN 'returning'
        WHEN t.delivery_status = 'returned' THEN 'returned'
        WHEN t.delivery_status = 'not_delivered' THEN 'ready_to_deliver'
        WHEN t.delivery_status = 'in_transit' THEN 'in_transit'
        ELSE 'delivered'
      END,
      'returnQrCode', cr.qr_code,
      'returnStatus', cr.status,
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
    LEFT JOIN public.collector_returns cr ON cr.transaction_id = t.id AND cr.status = 'pending'
    WHERE t.movement_type = 'collector' AND t.received_by = p_agent_id
    ORDER BY t.created_at DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_collector_deliveries(uuid, integer) TO anon;

-- ============================================================
-- 6. notifications — allow the 2 new types (18 existing + 2 new).
-- ============================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'stock_request_submitted', 'stock_request_resolved',
    'daily_report_submitted',
    'return_request_submitted', 'return_request_resolved',
    'delivery_assigned', 'delivery_status_update',
    'delivery_handoff_pending_sr', 'delivery_handoff_confirmed', 'delivery_handoff_disputed',
    'stock_released_to_you', 'stock_request_fulfilled',
    'stock_accepted', 'delivery_completed', 'delivery_received',
    'delivery_disputed_collector',
    'daily_report_accepted', 'discrepancy_found',
    'collector_return_initiated', 'collector_return_received'
  ));

NOTIFY pgrst, 'reload schema';

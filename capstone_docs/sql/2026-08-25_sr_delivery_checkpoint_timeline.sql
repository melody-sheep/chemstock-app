-- Sales Rep Track Deliveries needs the FULL checkpoint history (not just
-- the latest one) to render the same "Current Location" breadcrumb the
-- Collector's own Deliver Stock screen and the Manager's Track Deliveries
-- screen show — the Manager's side already gets this for free via its raw
-- PostgREST embed (getDeliveries()'s delivery_checkpoints(...) select), but
-- the Sales Rep side goes through get_my_deliveries (agent is always
-- `anon`, no RLS-gated embed available), which only ever returned
-- lastCheckpoint. Adds a `checkpoints` array (ascending) alongside the
-- existing `lastCheckpoint` — safe CREATE OR REPLACE, return type (jsonb)
-- and argument list both unchanged.
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
      ),
      'checkpoints', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'latitude', dc.latitude, 'longitude', dc.longitude, 'label', dc.label, 'createdAt', dc.created_at
        ) ORDER BY dc.created_at)
        FROM public.delivery_checkpoints dc WHERE dc.transaction_id = t.id
      ), '[]'::jsonb)
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

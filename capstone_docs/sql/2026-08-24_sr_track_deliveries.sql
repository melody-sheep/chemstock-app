-- Sales Rep "Track Deliveries": the SR-side mirror of the Manager's
-- TrackDeliveriesScreen, scoped to only the collector-mediated deliveries
-- where this Sales Rep is the target_recipient_id. Same underlying data
-- (transactions/transaction_details/gps_coordinates/delivery_checkpoints) —
-- no new tables. Sales Reps are always `anon` (no Supabase Auth session),
-- so this can't be a raw PostgREST embed like the manager screen's
-- inventoryService.getDeliveries() — it needs the same SECURITY DEFINER +
-- GRANT TO anon + explicit p_agent_id pattern as every other agent-facing
-- read this app has (get_transaction_by_qr_code_for_agent, get_sr_inventory,
-- get_my_stock_requests, etc.), resolving the collector's name server-side
-- via a plain JOIN rather than depending on user_profiles RLS.
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
        SELECT jsonb_build_object('latitude', dc.latitude, 'longitude', dc.longitude, 'createdAt', dc.created_at)
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

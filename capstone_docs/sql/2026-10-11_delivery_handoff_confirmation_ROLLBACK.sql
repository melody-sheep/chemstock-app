-- ============================================================================
-- 2026-10-11_delivery_handoff_confirmation_ROLLBACK.sql
-- Reverses the entire migration. Safe to run if anything goes wrong.
-- The migration is additive — no existing data was modified or deleted.
-- ============================================================================

-- 1. Restore finish_delivery_leg to its pre-migration body (no handoff block).
--    Copy the exact body from 2026-10-06c_notifications_system.sql.
--    (Reproduce it here in full — not deleting since the function must stay.)
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

  RETURN jsonb_build_object('tripCompleted', v_all_delivered);
END;
$$;

-- 2. Restore notifications.type CHECK constraint (7 original types).
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'stock_request_submitted', 'stock_request_resolved',
    'daily_report_submitted',
    'return_request_submitted', 'return_request_resolved',
    'delivery_assigned', 'delivery_status_update'
  ));

-- 3. Drop the two new RPCs.
DROP FUNCTION IF EXISTS public.confirm_delivery_handoff(uuid, uuid, double precision, double precision, text, text, text);
DROP FUNCTION IF EXISTS public.dispute_delivery_handoff(uuid, uuid, text);

-- 4. Restore sr_inventory.acceptance_id NOT NULL (only if all rows have one).
--    If any handoff-path rows exist, this will fail — that's a safety check,
--    not a bug. Delete those rows first if you really want to roll back.
ALTER TABLE public.sr_inventory DROP CONSTRAINT IF EXISTS sr_inventory_source_check;
ALTER TABLE public.sr_inventory DROP COLUMN IF EXISTS handoff_id;
ALTER TABLE public.sr_inventory ALTER COLUMN acceptance_id SET NOT NULL;

-- 5. Drop the new table (this also cascades the RLS policies).
DROP TABLE IF EXISTS public.delivery_handoffs CASCADE;

-- 6. Drop the two new gps_coordinates / media RLS policies.
DROP POLICY IF EXISTS "Managers can view gps for their branches' delivery handoffs"
  ON public.gps_coordinates;
DROP POLICY IF EXISTS "Managers can view media for their branches' delivery handoffs"
  ON public.media;
DROP POLICY IF EXISTS "Managers can view delivery handoff media for their branches"
  ON storage.objects;

-- 7. Refresh schema cache.
NOTIFY pgrst, 'reload schema';

-- Run in Supabase SQL editor. Safe to run more than once.
--
-- BL-1 (APK 1.0.3 test, decision: Alther, Oct 20): release_stock_batch now
-- refuses a batch whose exp_date is before today (Philippine date). The
-- release screens in the app already hide expired batches; this is the check
-- that holds even if an old app version or a stale screen sends one.
-- Only that check is added - every other line is the live body from
-- 2026-10-12_notification_focus_ids.sql (section 6).
--
-- To undo: re-run section 6 of 2026-10-12_notification_focus_ids.sql.
--
-- Test in the app (the SQL editor can't act as a manager):
--   1. release a normal batch                -> works
--   2. a batch expiring today                -> works
--   3. a batch that expired yesterday        -> "Cannot release expired stock: ..."

CREATE OR REPLACE FUNCTION public.release_stock_batch(
  p_branch_id uuid,
  p_recipient_id uuid,
  p_movement_type text,
  p_latitude double precision,
  p_longitude double precision,
  p_storage_path text,
  p_device_model text,
  p_device_os text,
  p_items jsonb,
  p_target_recipient_id uuid DEFAULT NULL,
  p_destination_latitude double precision DEFAULT NULL,
  p_destination_longitude double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_qr_code text;
  v_gps_id uuid;
  v_destination_gps_id uuid;
  v_media_id uuid;
  v_transaction_id uuid;
  v_item jsonb;
  v_row public.branch_inventory;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Only managers can release stock';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  IF p_movement_type = 'collector' AND (
       p_target_recipient_id IS NULL
       OR p_destination_latitude IS NULL
       OR p_destination_longitude IS NULL
     ) THEN
    RAISE EXCEPTION 'Collector releases require a target recipient and a destination GPS point';
  END IF;
  IF p_movement_type = 'direct' AND (
       p_target_recipient_id IS NOT NULL
       OR p_destination_latitude IS NOT NULL
       OR p_destination_longitude IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'Direct releases must not include a target recipient or destination GPS point';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_row FROM public.branch_inventory
      WHERE id = (v_item->>'branch_inventory_id')::uuid
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Batch % no longer exists', v_item->>'branch_inventory_id';
    END IF;
    -- BL-1: expired stock can't be released. Philippine date; a batch that
    -- expires today can still go out, one that expired yesterday can't.
    IF v_row.exp_date IS NOT NULL
       AND v_row.exp_date < (now() AT TIME ZONE 'Asia/Manila')::date THEN
      RAISE EXCEPTION 'Cannot release expired stock: % (batch %) expired on %',
        v_row.product_name, COALESCE(v_row.batch_number, '-'), to_char(v_row.exp_date, 'Mon DD, YYYY');
    END IF;
    IF v_row.quantity < (v_item->>'quantity')::integer THEN
      RAISE EXCEPTION 'Insufficient stock for %: have %, requested %',
        v_row.product_name, v_row.quantity, v_item->>'quantity';
    END IF;
  END LOOP;

  v_qr_code := encode(gen_random_bytes(12), 'hex');

  INSERT INTO public.gps_coordinates (latitude, longitude, captured_by)
    VALUES (p_latitude, p_longitude, auth.uid()) RETURNING id INTO v_gps_id;

  IF p_destination_latitude IS NOT NULL AND p_destination_longitude IS NOT NULL THEN
    INSERT INTO public.gps_coordinates (latitude, longitude, captured_by)
      VALUES (p_destination_latitude, p_destination_longitude, auth.uid())
      RETURNING id INTO v_destination_gps_id;
  END IF;
  
  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, auth.uid()) RETURNING id INTO v_media_id;

  INSERT INTO public.transactions
    (branch_id, released_by, received_by, movement_type, qr_code, gps_id,
     destination_gps_id, target_recipient_id, media_id)
    VALUES (p_branch_id, auth.uid(), p_recipient_id, p_movement_type, v_qr_code, v_gps_id,
            v_destination_gps_id, p_target_recipient_id, v_media_id)
    RETURNING id INTO v_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_row FROM public.branch_inventory WHERE id = (v_item->>'branch_inventory_id')::uuid;
    INSERT INTO public.transaction_details
      (transaction_id, branch_inventory_id, product_code, product_name, batch_number, mfg_date, exp_date, quantity)
      VALUES (v_transaction_id, v_row.id, v_row.product_code, v_row.product_name,
              v_row.batch_number, v_row.mfg_date, v_row.exp_date, (v_item->>'quantity')::integer);
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.branch_inventory
      SET quantity = quantity - (v_item->>'quantity')::integer
      WHERE id = (v_item->>'branch_inventory_id')::uuid;
  END LOOP;

  IF p_movement_type = 'collector' THEN
    PERFORM public._notify(
      p_recipient_id, 'delivery_assigned', 'New delivery assigned',
      'A delivery is ready for pickup.', 'CollectorAcceptDeliveries',
      jsonb_build_object('focusId', v_transaction_id)
    );
  END IF;

  RETURN jsonb_build_object('qrCode', v_qr_code, 'transactionId', v_transaction_id);
END;
$$;

-- Run in Supabase SQL editor, top to bottom. Safe to run more than once.
--
-- 1. Handoff distance warning (APK 1.0.3 test D8, decision: Alther, Oct 19)
--    When a Sales Rep confirms a collector handoff more than 200 m from where
--    the Collector marked it delivered, the Manager(s) of that branch, the
--    Sales Rep and the Collector each get a notification saying so and why.
--    confirm_delivery_handoff already stores that distance in
--    delivery_handoffs.distance_meters; this only adds a trigger on it, so
--    the confirm function itself is untouched. The receipt still completes —
--    the matching QR scan proves the stock was handed over; this is a
--    warning for the people involved to check, not a rejection.
--    200 m allows for GPS drift indoors and for fixes taken offline.
--
-- 2. Team map (APK 1.0.3 test BL6): get_team_last_locations() — for a
--    Manager, each Sales Rep / Collector in their branches with their last
--    known location (latest of: any geotagged action, delivery checkpoint,
--    daily report, stock request) and when it was taken. There is no live
--    tracking; this is the last place the app recorded them.

-- ============================================================
-- 1a. allow the new notification type (20 existing + 1 new)
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
    'collector_return_initiated', 'collector_return_received',
    'handoff_distance_warning'
  ));

-- ============================================================
-- 1b. trigger: warn everyone involved when the handoff was far apart
-- ============================================================
CREATE OR REPLACE FUNCTION public._warn_far_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
  v_sr_name text;
  v_collector_name text;
  v_distance text;
  v_manager record;
BEGIN
  SELECT branch_id INTO v_branch_id FROM public.transactions WHERE id = NEW.transaction_id;
  SELECT full_name INTO v_sr_name FROM public.user_profiles WHERE id = NEW.sr_id;
  SELECT full_name INTO v_collector_name FROM public.user_profiles WHERE id = NEW.collector_id;
  v_distance := CASE
    WHEN NEW.distance_meters >= 1000 THEN round((NEW.distance_meters / 1000.0)::numeric, 1)::text || ' km'
    ELSE round(NEW.distance_meters::numeric)::text || ' m'
  END;

  FOR v_manager IN
    SELECT id FROM public.user_profiles WHERE role = 'manager' AND v_branch_id = ANY(branch_ids)
  LOOP
    PERFORM public._notify(
      v_manager.id, 'handoff_distance_warning', 'Handoff far from delivery point',
      COALESCE(v_sr_name, 'The Sales Rep') || ' confirmed a delivery from ' || COALESCE(v_collector_name, 'the Collector')
        || ' ' || v_distance || ' away from where it was marked delivered. Please check this handover.',
      'TrackDeliveries', jsonb_build_object('focusId', NEW.transaction_id)
    );
  END LOOP;

  PERFORM public._notify(
    NEW.sr_id, 'handoff_distance_warning', 'Received far from delivery point',
    'You confirmed this delivery ' || v_distance || ' away from where '
      || COALESCE(v_collector_name, 'the Collector') || ' marked it delivered. Your manager has been notified.',
    'SalesRepTrackDeliveries', jsonb_build_object('transactionId', NEW.transaction_id)
  );

  PERFORM public._notify(
    NEW.collector_id, 'handoff_distance_warning', 'Delivered far from the Sales Rep',
    COALESCE(v_sr_name, 'The Sales Rep') || ' received this delivery ' || v_distance
      || ' away from where you marked it delivered. Your manager has been notified.',
    'CollectorDeliveredStock', jsonb_build_object('focusId', NEW.transaction_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warn_far_handoff ON public.delivery_handoffs;
CREATE TRIGGER trg_warn_far_handoff
  AFTER UPDATE OF handoff_status ON public.delivery_handoffs
  FOR EACH ROW
  WHEN (NEW.handoff_status = 'confirmed'
        AND OLD.handoff_status IS DISTINCT FROM 'confirmed'
        AND NEW.distance_meters > 200)
  EXECUTE FUNCTION public._warn_far_handoff();

-- ============================================================
-- 2. team map: last known location of each agent in the manager's branches
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_team_last_locations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_ids uuid[];
BEGIN
  SELECT branch_ids INTO v_branch_ids
    FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager';
  IF v_branch_ids IS NULL THEN
    RAISE EXCEPTION 'Only managers can view the team map';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t."fullName")
    FROM (
      SELECT
        up.id AS "agentId",
        up.full_name AS "fullName",
        up.role AS "role",
        m.storage_path AS "photoPath",
        up.last_seen_at AS "lastSeenAt",
        loc.latitude, loc.longitude,
        loc.captured_at AS "capturedAt",
        loc.source
      FROM public.user_profiles up
      LEFT JOIN public.media m ON m.id = up.profile_media_id
      LEFT JOIN LATERAL (
        SELECT * FROM (
          SELECT g.latitude, g.longitude, g.captured_at, 'activity'::text AS source
            FROM public.gps_coordinates g WHERE g.captured_by = up.id
          UNION ALL
          SELECT dc.latitude, dc.longitude, dc.captured_at, 'checkpoint'
            FROM public.delivery_checkpoints dc WHERE dc.captured_by = up.id
          UNION ALL
          SELECT dr.latitude, dr.longitude, dr.created_at, 'daily report'
            FROM public.daily_reports dr
            WHERE dr.agent_id = up.id AND dr.latitude IS NOT NULL AND dr.longitude IS NOT NULL
          UNION ALL
          SELECT sr.latitude, sr.longitude, sr.created_at, 'stock request'
            FROM public.stock_requests sr
            WHERE sr.requested_by = up.id AND sr.latitude IS NOT NULL AND sr.longitude IS NOT NULL
        ) all_locations
        ORDER BY captured_at DESC
        LIMIT 1
      ) loc ON true
      WHERE up.role IN ('sales_rep', 'collector')
        AND up.branch_ids && v_branch_ids
    ) t
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_last_locations() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Manager "Nudge" for an unreported / open discrepancy.  NOT RUN YET: review, then run once in the Supabase SQL editor.
--
-- What it does
--   1. Adds one notification type, 'report_reminder', to notifications_type_check. Every type that exists today is kept:
--      the list is read from the live constraint, so nothing already allowed is dropped.
--   2. nudge_report_item(p_report_item_id): a Manager reminds the Sales Rep about one item from a daily report that is
--      still unreported (carried forward) or not yet settled. It creates a normal notification for the Sales Rep, so it
--      shows in their bell AND sends a push (the push trigger from 2026-10-28_push_notifications.sql fires on every
--      new notification). Tapping it opens that item.
--
-- Rules inside the function
--   * only a signed-in Manager, and only for a Sales Rep report in one of that Manager's branches;
--   * not for an item that is already settled;
--   * at most one reminder per item every 3 hours (the answer says when the next one is allowed).
--
-- Safety for the live client: no data is changed. The constraint is recreated with the same types plus one, so every
-- existing notification still passes. Rollback: 2026-10-28b_nudge_sales_rep_ROLLBACK.sql

-- ============================================================
-- 1. allow 'report_reminder' (keeps every existing type)
-- ============================================================
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conname = 'notifications_type_check' AND conrelid = 'public.notifications'::regclass;
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'notifications_type_check was not found; nothing changed.';
  END IF;
  IF position('''report_reminder''' IN v_def) > 0 THEN
    RETURN;                                  -- already added
  END IF;
  IF position('ARRAY[' IN v_def) = 0 THEN
    RAISE EXCEPTION 'Unexpected constraint shape, nothing changed: %', v_def;
  END IF;
  v_def := replace(v_def, 'ARRAY[', 'ARRAY[''report_reminder''::text, ');
  ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
  EXECUTE 'ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check ' || v_def;
END $$;

-- ============================================================
-- 2. the nudge
-- ============================================================
CREATE OR REPLACE FUNCTION public.nudge_report_item(p_report_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager public.user_profiles;
  v_item record;
  v_last timestamptz;
  v_gap constant interval := interval '3 hours';
  v_qty integer;
  v_day text;
BEGIN
  SELECT * INTO v_manager FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a manager can send a reminder';
  END IF;

  SELECT dri.id, dri.product_code, dri.discrepancy, dri.resolution_status,
         dr.agent_id, dr.branch_id, dr.report_date, dr.carry_forward_enabled
    INTO v_item
    FROM public.daily_report_items dri
    JOIN public.daily_reports dr ON dr.id = dri.report_id
   WHERE dri.id = p_report_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This item was not found';
  END IF;
  IF NOT (v_item.branch_id = ANY (v_manager.branch_ids)) THEN
    RAISE EXCEPTION 'This Sales Rep is not in your branch';
  END IF;
  IF v_item.resolution_status = 'resolved' OR v_item.discrepancy = 0 THEN
    RAISE EXCEPTION 'This item is already settled';
  END IF;

  SELECT max(created_at) INTO v_last
    FROM public.notifications
   WHERE recipient_id = v_item.agent_id
     AND type = 'report_reminder'
     AND nav_params ->> 'focusId' = p_report_item_id::text;
  IF v_last IS NOT NULL AND v_last > now() - v_gap THEN
    RETURN jsonb_build_object('sent', false, 'nextAllowedAt', v_last + v_gap);
  END IF;

  v_qty := abs(v_item.discrepancy);
  v_day := to_char(v_item.report_date, 'Mon FMDD');
  PERFORM public._notify(
    v_item.agent_id,
    'report_reminder',
    'Reminder from your Manager',
    COALESCE(v_manager.full_name, 'Your Manager') || ' asked you to report ' || v_qty || ' ' || v_item.product_code ||
      CASE WHEN v_item.carry_forward_enabled
        THEN ' still in your backpack (from your ' || v_day || ' report). Include it in your next report.'
        ELSE ' from your ' || v_day || ' report. Settle it under Alerts / Discrepancies.'
      END,
    'AlertsDiscrepanciesSR',
    jsonb_build_object('focusId', p_report_item_id)
  );
  RETURN jsonb_build_object('sent', true, 'nextAllowedAt', now() + v_gap);
END;
$$;

REVOKE ALL ON FUNCTION public.nudge_report_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nudge_report_item(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

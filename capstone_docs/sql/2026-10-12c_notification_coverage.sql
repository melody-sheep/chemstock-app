-- 2026-10-12c_notification_coverage.sql
-- Run in the Supabase SQL editor, top to bottom. Safe to re-run.
--
-- Adds the notifications that were missing: events that already showed in
-- Transaction Logs but told nobody.
--
-- Done with table triggers, NOT by redefining the action RPCs. No existing
-- function is touched (release_stock_batch, accept_stock_release,
-- finish_delivery_leg, confirm/dispute_delivery_handoff, accept_daily_report
-- all stay exactly as they are) — each trigger just reacts to the row those
-- functions already write, in the same transaction.
--
--   Table / event                               Who is told          Type
--   transactions INSERT (direct)                Sales Rep            stock_released_to_you
--   stock_requests linked to a collector release Sales Rep           stock_request_fulfilled
--   stock_acceptances INSERT                    releasing Manager    stock_accepted
--   transactions delivery_status -> delivered   releasing Manager    delivery_completed
--   delivery_handoffs -> confirmed              releasing Manager    delivery_received
--   delivery_handoffs -> disputed               Collector            delivery_disputed_collector
--   daily_reports -> accepted (by a manager)    Sales Rep            daily_report_accepted
--   daily_report_items INSERT with a shortfall  Sales Rep + Managers discrepancy_found (once per report)

-- ============================================================
-- 1. Allow the 8 new types (10 existing + 8 new)
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
    'daily_report_accepted', 'discrepancy_found'
  ));

-- ============================================================
-- 2. transactions: direct release -> Sales Rep; delivered -> Manager
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_notify_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.movement_type = 'direct' THEN
      SELECT full_name INTO v_name FROM public.user_profiles WHERE id = NEW.released_by;
      PERFORM public._notify(
        NEW.received_by, 'stock_released_to_you', 'Stock released to you',
        COALESCE(v_name, 'Your manager') || ' released stock to you. Scan the QR to receive it.',
        'ReceiveStockTypeSR', jsonb_build_object('focusId', NEW.id)
      );
    END IF;
  ELSIF NEW.delivery_status = 'delivered' AND OLD.delivery_status IS DISTINCT FROM 'delivered' THEN
    SELECT full_name INTO v_name FROM public.user_profiles WHERE id = NEW.target_recipient_id;
    PERFORM public._notify(
      NEW.released_by, 'delivery_completed', 'Delivery completed',
      'The delivery to ' || COALESCE(v_name, 'the Sales Rep') || ' has arrived.',
      'TrackDeliveries', jsonb_build_object('focusId', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_transaction_insert ON public.transactions;
CREATE TRIGGER trg_notify_transaction_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public._trg_notify_transaction();

DROP TRIGGER IF EXISTS trg_notify_transaction_delivered ON public.transactions;
CREATE TRIGGER trg_notify_transaction_delivered
  AFTER UPDATE OF delivery_status ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public._trg_notify_transaction();

-- ============================================================
-- 3. stock_requests: linked to its release -> Sales Rep
--    Only for a collector release. A direct release already told the
--    Sales Rep through the transactions trigger above.
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_notify_request_fulfilled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_movement text;
BEGIN
  IF NEW.fulfilled_transaction_id IS NOT NULL AND OLD.fulfilled_transaction_id IS NULL THEN
    SELECT movement_type INTO v_movement FROM public.transactions WHERE id = NEW.fulfilled_transaction_id;
    IF v_movement = 'collector' THEN
      PERFORM public._notify(
        NEW.requested_by, 'stock_request_fulfilled', 'Your stock request is on its way',
        'Your requested stock was released and handed to a collector.',
        'SalesRepStockRequests', jsonb_build_object('focusId', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_request_fulfilled ON public.stock_requests;
CREATE TRIGGER trg_notify_request_fulfilled
  AFTER UPDATE OF fulfilled_transaction_id ON public.stock_requests
  FOR EACH ROW EXECUTE FUNCTION public._trg_notify_request_fulfilled();

-- ============================================================
-- 4. stock_acceptances: stock accepted -> the Manager who released it
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_notify_stock_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_by uuid;
  v_name text;
BEGIN
  SELECT released_by INTO v_released_by FROM public.transactions WHERE id = NEW.transaction_id;
  SELECT full_name INTO v_name FROM public.user_profiles WHERE id = NEW.accepted_by;
  PERFORM public._notify(
    v_released_by, 'stock_accepted', 'Stock accepted',
    COALESCE(v_name, 'The recipient') || ' accepted the stock you released.',
    'StockLogs', jsonb_build_object('focusId', NEW.transaction_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_stock_accepted ON public.stock_acceptances;
CREATE TRIGGER trg_notify_stock_accepted
  AFTER INSERT ON public.stock_acceptances
  FOR EACH ROW EXECUTE FUNCTION public._trg_notify_stock_accepted();

-- ============================================================
-- 5. delivery_handoffs: confirmed -> Manager; disputed -> Collector
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_notify_handoff_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_by uuid;
  v_name text;
BEGIN
  IF NEW.handoff_status = OLD.handoff_status THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO v_name FROM public.user_profiles WHERE id = NEW.sr_id;

  IF NEW.handoff_status = 'confirmed' THEN
    SELECT released_by INTO v_released_by FROM public.transactions WHERE id = NEW.transaction_id;
    PERFORM public._notify(
      v_released_by, 'delivery_received', 'Delivery received',
      COALESCE(v_name, 'The Sales Rep') || ' confirmed receipt of the delivery.',
      'TrackDeliveries', jsonb_build_object('focusId', NEW.transaction_id)
    );
  ELSIF NEW.handoff_status = 'disputed' THEN
    PERFORM public._notify(
      NEW.collector_id, 'delivery_disputed_collector', 'Delivery disputed',
      COALESCE(v_name, 'The Sales Rep') || ' reported an issue'
        || CASE WHEN NEW.dispute_reason IS NOT NULL AND btrim(NEW.dispute_reason) <> ''
             THEN ': ' || NEW.dispute_reason ELSE '.' END,
      'CollectorDeliveredStock', jsonb_build_object('focusId', NEW.transaction_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_handoff_status ON public.delivery_handoffs;
CREATE TRIGGER trg_notify_handoff_status
  AFTER UPDATE OF handoff_status ON public.delivery_handoffs
  FOR EACH ROW EXECUTE FUNCTION public._trg_notify_handoff_status();

-- ============================================================
-- 6. daily_reports: accepted by a manager -> Sales Rep
--    Auto-filed reports are INSERTed already accepted, so they never fire this.
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_notify_report_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    PERFORM public._notify(
      NEW.agent_id, 'daily_report_accepted', 'Daily report accepted',
      'Your daily report for ' || to_char(NEW.report_date, 'Mon DD') || ' was accepted.',
      'SalesRepReports', jsonb_build_object('focusId', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_report_accepted ON public.daily_reports;
CREATE TRIGGER trg_notify_report_accepted
  AFTER UPDATE OF status ON public.daily_reports
  FOR EACH ROW EXECUTE FUNCTION public._trg_notify_report_accepted();

-- ============================================================
-- 7. daily_report_items: a shortfall -> Sales Rep + branch Managers
--    One notification per report per person, however many items are short.
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_notify_discrepancy_found()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.daily_reports;
  v_name text;
  v_manager_id uuid;
  v_params jsonb;
BEGIN
  IF NEW.resolution_status <> 'open' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_report FROM public.daily_reports WHERE id = NEW.report_id;
  v_params := jsonb_build_object('focusId', NEW.report_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE recipient_id = v_report.agent_id AND type = 'discrepancy_found' AND nav_params = v_params
  ) THEN
    PERFORM public._notify(
      v_report.agent_id, 'discrepancy_found', 'Discrepancy found',
      'Your report for ' || to_char(v_report.report_date, 'Mon DD') || ' has missing stock. Open Alerts to resolve it.',
      'AlertsDiscrepanciesSR', v_params
    );
  END IF;

  SELECT full_name INTO v_name FROM public.user_profiles WHERE id = v_report.agent_id;
  FOR v_manager_id IN
    SELECT id FROM public.user_profiles WHERE role = 'manager' AND v_report.branch_id = ANY(branch_ids)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE recipient_id = v_manager_id AND type = 'discrepancy_found' AND nav_params = v_params
    ) THEN
      PERFORM public._notify(
        v_manager_id, 'discrepancy_found', 'Discrepancy found',
        COALESCE(v_name, 'A sales rep') || '''s report for ' || to_char(v_report.report_date, 'Mon DD') || ' has missing stock.',
        'ManagerAlerts', v_params
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_discrepancy_found ON public.daily_report_items;
CREATE TRIGGER trg_notify_discrepancy_found
  AFTER INSERT ON public.daily_report_items
  FOR EACH ROW EXECUTE FUNCTION public._trg_notify_discrepancy_found();

-- Trigger functions are internal — nothing calls them directly.
REVOKE ALL ON FUNCTION public._trg_notify_transaction() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._trg_notify_request_fulfilled() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._trg_notify_stock_accepted() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._trg_notify_handoff_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._trg_notify_report_accepted() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._trg_notify_discrepancy_found() FROM PUBLIC;

-- 2026-10-21_reopen_request_on_return.sql
-- BL-2. Run in the Supabase SQL editor, top to bottom. Safe to re-run.
--
-- Problem: when a Collector returns a delivery and the Manager confirms it
-- (confirm_collector_return), the stock goes back into branch inventory, but
-- the Sales Rep's stock request stayed "Fulfilled": stock_requests keeps
-- fulfilled_transaction_id, and that column is UNIQUE, so the request could not
-- be fulfilled again.
--
-- Fix (the "back to Preparing" choice): when a transaction becomes 'returned',
-- clear fulfilled_transaction_id on the request it fulfilled. The request stays
-- 'accepted' with no link, which the app already shows as "Preparing", and the
-- Manager can link it to a new release. The Sales Rep gets a notification.
--
-- This is a new trigger only. confirm_collector_return, the return flow and
-- every other function are untouched. Undo: 2026-10-21_reopen_request_on_return_ROLLBACK.sql

CREATE OR REPLACE FUNCTION public._reopen_request_on_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
BEGIN
  FOR v_req IN
    SELECT id, requested_by FROM public.stock_requests WHERE fulfilled_transaction_id = NEW.id
  LOOP
    UPDATE public.stock_requests SET fulfilled_transaction_id = NULL WHERE id = v_req.id;

    PERFORM public._notify(
      v_req.requested_by, 'stock_request_resolved', 'Your stock request is open again',
      'The stock released for your request was returned to the branch, so your Manager will prepare it again.',
      'SalesRepStockRequests', jsonb_build_object('focusId', v_req.id)
    );
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reopen_request_on_return ON public.transactions;
CREATE TRIGGER reopen_request_on_return
  AFTER UPDATE OF delivery_status ON public.transactions
  FOR EACH ROW
  WHEN (OLD.delivery_status IS DISTINCT FROM 'returned' AND NEW.delivery_status = 'returned')
  EXECUTE FUNCTION public._reopen_request_on_return();

NOTIFY pgrst, 'reload schema';

-- Check: one row = the trigger exists.
SELECT tgname FROM pg_trigger WHERE tgname = 'reopen_request_on_return' AND NOT tgisinternal;

-- Check for requests stuck from before this fix (read-only): fulfilled by a transaction that was already returned.
SELECT sr.id AS request_id, sr.requested_by, sr.fulfilled_transaction_id
FROM public.stock_requests sr
JOIN public.transactions t ON t.id = sr.fulfilled_transaction_id
WHERE t.delivery_status = 'returned';
-- If that lists rows, they are old returned deliveries still marked Fulfilled. To reopen them once:
--   UPDATE public.stock_requests sr SET fulfilled_transaction_id = NULL
--   FROM public.transactions t
--   WHERE t.id = sr.fulfilled_transaction_id AND t.delivery_status = 'returned';

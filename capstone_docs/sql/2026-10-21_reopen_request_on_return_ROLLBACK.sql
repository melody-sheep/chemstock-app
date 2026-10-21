-- 2026-10-21_reopen_request_on_return_ROLLBACK.sql
-- Undo of 2026-10-21_reopen_request_on_return.sql. Only removes the trigger and its function.
-- Requests that were already reopened stay open (that data is not reverted).

DROP TRIGGER IF EXISTS reopen_request_on_return ON public.transactions;
DROP FUNCTION IF EXISTS public._reopen_request_on_return();

NOTIFY pgrst, 'reload schema';

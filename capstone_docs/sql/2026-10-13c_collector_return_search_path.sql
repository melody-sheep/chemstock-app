-- 2026-10-13c_collector_return_search_path.sql
-- Run in the Supabase SQL editor, top to bottom. Safe to re-run.
--
-- Fixes "Failed to Start Return: function gen_random_bytes(integer) does not
-- exist" (seen on device Oct 13, Collector -> Accept Deliveries -> hold an
-- item -> Return to Manager).
--
-- Cause: initiate_collector_return (2026-10-13b) builds its QR with
-- gen_random_bytes(), which lives in the `extensions` schema on Supabase,
-- but the function was created with `SET search_path = public` only. Same
-- gotcha as crypt()/gen_salt() on Aug 14, release_stock_batch on Aug 21 and
-- again on Oct 12.
--
-- This only changes the function's search_path. Its body, signature and
-- grants are untouched. 2026-10-13b has been corrected too, so a fresh run
-- of that file no longer needs this one.

ALTER FUNCTION public.initiate_collector_return(uuid, uuid)
  SET search_path = public, extensions;

NOTIFY pgrst, 'reload schema';

-- Check: proconfig should read {"search_path=public, extensions"}.
SELECT proname, proconfig
FROM pg_proc
WHERE proname = 'initiate_collector_return';

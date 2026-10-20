-- Undo 2026-10-20e_admin_activity_log.sql. This DELETES the recorded admin
-- activity — export it from the admin tool first if you want to keep it.
-- (The trigger is dropped first, otherwise the table's own protection would
-- block the clean-up.)

DROP TRIGGER IF EXISTS admin_activity_log_readonly ON public.admin_activity_log;
DROP TABLE IF EXISTS public.admin_activity_log;
DROP FUNCTION IF EXISTS public._admin_activity_log_readonly();

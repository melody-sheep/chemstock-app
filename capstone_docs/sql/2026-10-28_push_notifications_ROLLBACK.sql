-- Undoes 2026-10-28_push_notifications.sql. Safe to run: it only removes what that file added.
-- Notifications keep working exactly as before. (The pg_net extension is left installed; it is harmless.)

DROP TRIGGER IF EXISTS trg_push_on_notification ON public.notifications;
DROP FUNCTION IF EXISTS public._push_on_notification();
DROP FUNCTION IF EXISTS public.register_push_token(text, uuid, text);
DROP FUNCTION IF EXISTS public.unregister_push_token(text);
DROP TABLE IF EXISTS public.push_tokens;

NOTIFY pgrst, 'reload schema';

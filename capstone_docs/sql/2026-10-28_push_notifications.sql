-- Push notifications (APK 1.0.2 build 12 and later).  NOT RUN YET: review, take a backup, then run once in the Supabase SQL editor.
--
-- What it does
--   1. push_tokens: one row per phone (Expo push token) and the user who is signed in on it.
--   2. register_push_token / unregister_push_token: how the app adds and removes its own row.
--   3. A trigger on notifications: every new notification row also sends a push to that user's phones,
--      through Expo's free push service (https://exp.host/--/api/v2/push/send), using pg_net (asynchronous,
--      so it never slows down or blocks the notification itself).
--
-- Safety for the live client
--   * Nothing changes for anyone until an updated app registers a token: with no token the trigger returns at once.
--   * The trigger swallows every error: a failed push can never stop a notification from being saved.
--   * No existing table, function or trigger is changed. Rollback: 2026-10-28_push_notifications_ROLLBACK.sql
--
-- Known limit (same as TODO P0-5): Sales Reps and Collectors have no Supabase login, so register_push_token trusts
-- the agent id the app sends. Someone who knows an agent's id could register their own phone for that agent and
-- read that agent's notification titles. Fixing P0-5 closes this too.

-- ============================================================
-- 1. pg_net (HTTP calls from the database; free on Supabase)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- 2. tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'android',
  device_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

-- No policies on purpose: only the functions below touch this table.
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. register / unregister
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_push_token(
  p_token text,
  p_agent_id uuid DEFAULT NULL,
  p_device_model text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF p_token IS NULL OR p_token !~ '^Expo(nent)?PushToken\[.+\]$' THEN
    RAISE EXCEPTION 'Invalid push token';
  END IF;

  v_user := auth.uid();                       -- a Manager (Supabase login)
  IF v_user IS NULL THEN                      -- a Sales Rep or Collector (no Supabase login)
    SELECT id INTO v_user FROM public.user_profiles
      WHERE id = p_agent_id AND role IN ('sales_rep', 'collector');
  END IF;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- One phone, one user: signing in as someone else on the same phone moves the token.
  INSERT INTO public.push_tokens (token, user_id, device_model)
    VALUES (p_token, v_user, p_device_model)
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id, device_model = EXCLUDED.device_model, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_push_token(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.push_tokens WHERE token = p_token;
$$;

REVOKE ALL ON FUNCTION public.register_push_token(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unregister_push_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_push_token(text) TO anon, authenticated;

-- ============================================================
-- 4. send a push for every new notification
-- ============================================================
CREATE OR REPLACE FUNCTION public._push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tokens text[];
BEGIN
  SELECT array_agg(token) INTO v_tokens FROM public.push_tokens WHERE user_id = NEW.recipient_id;
  IF v_tokens IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
    body := (
      SELECT jsonb_agg(jsonb_build_object(
        'to', t,
        'title', NEW.title,
        'body', NEW.body,
        'sound', 'default',
        'priority', 'high',
        'channelId', 'default',
        'data', jsonb_build_object(
          'notificationId', NEW.id,
          'type', NEW.type,
          'navTarget', NEW.nav_target,
          'navParams', NEW.nav_params
        )
      ))
      FROM unnest(v_tokens) AS t
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;                                 -- a failed push must never block the notification
END;
$$;

DROP TRIGGER IF EXISTS trg_push_on_notification ON public.notifications;
CREATE TRIGGER trg_push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public._push_on_notification();

-- ============================================================
-- Test (only with one of OUR test accounts, never the client's): after that account logs in on an updated APK and
-- allows notifications, this creates a real notification, which also sends the push. Fill in the user id.
--   select public._notify('<user id>', 'delivery_status_update', 'Test push', 'Hello from ChemStock', NULL, '{}'::jsonb);
-- See what Expo answered (errors such as DeviceNotRegistered show up here):
--   select created, status_code, content from net._http_response order by created desc limit 5;
-- ============================================================

NOTIFY pgrst, 'reload schema';

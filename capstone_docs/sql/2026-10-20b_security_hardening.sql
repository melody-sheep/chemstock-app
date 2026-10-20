-- Run in Supabase SQL editor, top to bottom. Safe to run more than once.
-- To undo: 2026-10-20b_security_hardening_ROLLBACK.sql
--
-- Security review, Oct 20 (decision: Alther). Closes the holes found in the
-- live policies / grants:
--
--  1. user_profiles could be INSERTed by any logged-in user with any role and
--     branches ("Enable insert for authenticated users only" = true, and
--     "Users can insert own profile" didn't limit role/branch_ids). Anyone who
--     signed up through the public API could make themselves a manager of
--     every branch. Profiles are only ever created by SECURITY DEFINER
--     functions (activate_manager, create_agent_account), so both go.
--  2. activation_keys: every unused key (code, manager email, branches) was
--     readable by anyone holding the app's public key, and anyone could mark
--     keys used. Replaced by check_activation_code(): one code in, its own
--     details out. Writes stay with the admin tool (service role).
--  3. activate_manager(): now also requires the logged-in email to be the
--     key's email (a stolen code is useless on another account), a free
--     username, and no existing profile (N5).
--  4. verify_agent_login(): returned the whole row, password_hash included.
--     Now returns the same fields minus password_hash, and locks a Sales Rep /
--     Collector username for 15 min after 5 wrong passwords in 15 min.
--  5. get_email_by_username(): only answers for managers (the only accounts
--     that log in with an email behind the scenes) and is throttled.
--  6. activation_audit_log: no more public inserts (the admin tool writes with
--     the service role).
--  7. Internal helper functions (_notify, _build_daily_report, trigger
--     functions, …) were callable by anyone; e.g. _notify could send any
--     notification to any user. Execute is removed from the public roles,
--     except where a SECURITY INVOKER function still calls the helper (those
--     are listed as NOTICEs and left as they are).
--
-- App compatibility: 1.0.6 and older keep working for login and daily use.
-- Only Manager ACTIVATION needs 1.0.7 (older builds read activation_keys
-- directly, which is now closed).
--
-- Not covered here: P0-5 (agent functions trust the agent id the app sends).
-- That needs agent session tokens across every agent function and the app —
-- planned as its own step.

-- ============================================================
-- 1. user_profiles: no direct inserts from the app
-- ============================================================
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- ============================================================
-- 2. activation_keys: no public read, no public update
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read valid activation keys" ON public.activation_keys;
DROP POLICY IF EXISTS "Authenticated users can update keys" ON public.activation_keys;

CREATE OR REPLACE FUNCTION public.check_activation_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key public.activation_keys;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) < 4 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_key FROM public.activation_keys WHERE code = trim(p_code) LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'NOT_FOUND');
  END IF;
  IF v_key.is_used THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'ALREADY_USED');
  END IF;
  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'EXPIRED');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', v_key.id,
    'code', v_key.code,
    'manager_name', v_key.manager_name,
    'manager_email', v_key.manager_email,
    'branch_names', COALESCE(to_jsonb(v_key.branch_names), '[]'::jsonb),
    'branch_locations', COALESCE(to_jsonb(v_key.branch_locations), '[]'::jsonb),
    'branch_ids', COALESCE(to_jsonb(v_key.branch_ids), '[]'::jsonb),
    'expires_at', v_key.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_activation_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_activation_code(text) TO anon, authenticated;

-- N5: lets the activation screen say "username taken" BEFORE the login
-- account is created, so a failed activation can't leave an account behind.
CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE lower(username) = lower(trim(p_username))
  );
$$;

REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- ============================================================
-- 3. activate_manager: email must match the key, username must be free
-- ============================================================
CREATE OR REPLACE FUNCTION public.activate_manager(p_code text, p_user_id uuid, p_username text, p_full_name text)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key public.activation_keys;
  v_profile public.user_profiles;
  v_email text := lower(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'This account is already activated. Log in instead.';
  END IF;

  IF p_username IS NULL OR length(trim(p_username)) < 3 THEN
    RAISE EXCEPTION 'Please enter a username of at least 3 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE lower(username) = lower(trim(p_username))) THEN
    RAISE EXCEPTION 'That username is already taken. Please choose another.';
  END IF;

  SELECT * INTO v_key FROM public.activation_keys
    WHERE code = p_code AND is_used = false
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already-used activation code';
  END IF;

  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RAISE EXCEPTION 'Activation code has expired';
  END IF;

  -- A code only works for the email it was issued to.
  IF lower(trim(v_key.manager_email)) <> v_email THEN
    RAISE EXCEPTION 'This activation code was issued for a different email';
  END IF;

  UPDATE public.activation_keys
    SET is_used = true, used_at = now(), updated_at = now()
    WHERE id = v_key.id;

  INSERT INTO public.user_profiles (id, username, full_name, email, role, branch_ids)
  VALUES (p_user_id, trim(p_username), p_full_name, v_key.manager_email, 'manager', v_key.branch_ids)
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

-- Needs a logged-in Supabase user; the public role never could use it.
REVOKE ALL ON FUNCTION public.activate_manager(text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_manager(text, uuid, text, text) TO authenticated;

-- ============================================================
-- 4. Agent login: no password hash in the reply, lockout after 5 misses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.login_attempts (
  username      text PRIMARY KEY,
  failed_count  integer NOT NULL DEFAULT 0,
  first_failed_at timestamptz,
  locked_until  timestamptz,
  lookup_count  integer NOT NULL DEFAULT 0,
  lookup_window_start timestamptz
);
-- RLS on with no policies: only the SECURITY DEFINER functions below touch it.
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_attempts FROM anon, authenticated;

DROP FUNCTION IF EXISTS public.verify_agent_login(text, text);

CREATE FUNCTION public.verify_agent_login(p_username text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text := lower(trim(COALESCE(p_username, '')));
  v_attempt public.login_attempts;
  v_profile public.user_profiles;
  v_is_agent boolean;
  c_max_failures constant integer := 5;
  c_window constant interval := interval '15 minutes';
  c_lock constant interval := interval '15 minutes';
BEGIN
  IF v_key = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_attempt FROM public.login_attempts WHERE username = v_key;
  IF FOUND AND v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > now() THEN
    RAISE EXCEPTION 'Too many failed attempts. Try again in % minute(s).',
      GREATEST(1, ceil(extract(epoch FROM (v_attempt.locked_until - now())) / 60)::integer);
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles
    WHERE username = trim(p_username)
      AND password_hash IS NOT NULL
      AND password_hash = crypt(p_password, password_hash)
    LIMIT 1;

  IF FOUND THEN
    DELETE FROM public.login_attempts WHERE username = v_key AND lookup_count = 0;
    UPDATE public.login_attempts
      SET failed_count = 0, first_failed_at = NULL, locked_until = NULL
      WHERE username = v_key;
    RETURN to_jsonb(v_profile) - 'password_hash';
  END IF;

  -- Only Sales Rep / Collector usernames count toward the lock. Managers sign
  -- in with Supabase Auth (which has its own limits); the app tries this
  -- function first for every login, so counting them would lock managers out.
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE username = trim(p_username) AND password_hash IS NOT NULL
  ) INTO v_is_agent;

  IF v_is_agent THEN
    INSERT INTO public.login_attempts (username, failed_count, first_failed_at)
      VALUES (v_key, 1, now())
    ON CONFLICT (username) DO UPDATE SET
      failed_count = CASE
        WHEN public.login_attempts.first_failed_at IS NULL
          OR public.login_attempts.first_failed_at < now() - c_window THEN 1
        ELSE public.login_attempts.failed_count + 1 END,
      first_failed_at = CASE
        WHEN public.login_attempts.first_failed_at IS NULL
          OR public.login_attempts.first_failed_at < now() - c_window THEN now()
        ELSE public.login_attempts.first_failed_at END,
      locked_until = NULL;

    UPDATE public.login_attempts
      SET locked_until = now() + c_lock
      WHERE username = v_key AND failed_count >= c_max_failures;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_agent_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_agent_login(text, text) TO anon, authenticated;

-- ============================================================
-- 5. get_email_by_username: managers only, throttled per username
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text := lower(trim(COALESCE(p_username, '')));
  v_attempt public.login_attempts;
  v_email text;
BEGIN
  IF v_key = '' THEN
    RETURN NULL;
  END IF;

  -- 20 look-ups per username per 15 minutes is far above normal use.
  INSERT INTO public.login_attempts (username, lookup_count, lookup_window_start)
    VALUES (v_key, 1, now())
  ON CONFLICT (username) DO UPDATE SET
    lookup_count = CASE
      WHEN public.login_attempts.lookup_window_start IS NULL
        OR public.login_attempts.lookup_window_start < now() - interval '15 minutes' THEN 1
      ELSE public.login_attempts.lookup_count + 1 END,
    lookup_window_start = CASE
      WHEN public.login_attempts.lookup_window_start IS NULL
        OR public.login_attempts.lookup_window_start < now() - interval '15 minutes' THEN now()
      ELSE public.login_attempts.lookup_window_start END
  RETURNING * INTO v_attempt;

  IF v_attempt.lookup_count > 20 THEN
    RAISE EXCEPTION 'Too many failed attempts. Try again in 15 minute(s).';
  END IF;

  SELECT email INTO v_email FROM public.user_profiles
    WHERE username = trim(p_username) AND role = 'manager'
    LIMIT 1;
  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;

-- ============================================================
-- 6. activation_audit_log: no public inserts
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.activation_audit_log;

-- ============================================================
-- 7. Internal helpers: not callable from the app
-- ============================================================
DO $$
DECLARE
  v_fn record;
  v_caller text;
BEGIN
  FOR v_fn IN
    SELECT p.oid, p.proname, p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE '\_%' ESCAPE '\' OR p.proname = 'rls_auto_enable')
  LOOP
    -- A SECURITY INVOKER function runs as the caller, so it still needs to
    -- be able to call the helper. Leave those helpers alone and say so.
    SELECT string_agg(c.proname, ', ') INTO v_caller
    FROM pg_proc c JOIN pg_namespace cn ON cn.oid = c.pronamespace
    WHERE cn.nspname = 'public'
      AND c.oid <> v_fn.oid
      AND NOT c.prosecdef
      AND c.prosrc ~ ('\m' || v_fn.proname || '\M');

    IF v_caller IS NOT NULL THEN
      RAISE NOTICE 'Kept % callable: used by security-invoker function(s) %', v_fn.sig, v_caller;
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_fn.sig);
      RAISE NOTICE 'Revoked app access to %', v_fn.sig;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================
-- Check (optional): what the app's public key can still read directly.
-- Expect: no rows for activation_keys / activation_audit_log / user_profiles inserts.
-- ============================================================
-- SELECT tablename, policyname, cmd, roles FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('activation_keys','activation_audit_log','user_profiles');

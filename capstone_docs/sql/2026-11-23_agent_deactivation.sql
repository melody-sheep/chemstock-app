-- Run in Supabase SQL editor, top to bottom.
--
-- Agent (Sales Rep / Collector) deactivation: a manager can switch an account
-- off instead of deleting it. History (stock logs, deliveries, returns) keeps
-- pointing at the profile, and the account can be switched back on later.
--
-- Agents don't use Supabase Auth, so this is a flag on user_profiles checked
-- by verify_agent_login and get_agent_profile (the app's session refresh).
--
-- Rollback: 2026-11-23_agent_deactivation_ROLLBACK.sql

BEGIN;

-- ============================================================
-- 1. Columns
-- ============================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- ============================================================
-- 2. set_agent_active(p_agent_id, p_active) — scoped exactly like
--    delete_agent_account / reset_agent_password: caller is a manager, the
--    target was created by that manager, and is a sales_rep/collector.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_agent_active(p_agent_id uuid, p_active boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Only managers can deactivate agent accounts';
  END IF;

  UPDATE public.user_profiles
  SET is_active = p_active,
      deactivated_at = CASE WHEN p_active THEN NULL ELSE now() END
  WHERE id = p_agent_id
    AND created_by = auth.uid()
    AND role IN ('sales_rep', 'collector');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'Account not found or you do not have permission to change it';
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_agent_active(uuid, boolean) TO authenticated;

-- ============================================================
-- 3. get_my_agent_accounts now returns is_active. Dropped first: adding an
--    output column can't be done with CREATE OR REPLACE.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_my_agent_accounts();

CREATE FUNCTION public.get_my_agent_accounts()
RETURNS TABLE (
  id uuid,
  username character varying,
  full_name character varying,
  role text,
  branch_ids uuid[],
  created_at timestamptz,
  profile_photo_path text,
  is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.username, up.full_name, up.role, up.branch_ids, up.created_at, m.storage_path, up.is_active
  FROM public.user_profiles up
  LEFT JOIN public.media m ON m.id = up.profile_media_id
  WHERE up.created_by = auth.uid()
  ORDER BY up.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_agent_accounts() TO authenticated;

-- ============================================================
-- 4. get_agent_profile gains is_active so the app can end a deactivated
--    agent's saved session on its next profile refresh.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_agent_profile(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', up.id,
    'username', up.username,
    'full_name', up.full_name,
    'role', up.role,
    'branch_ids', up.branch_ids,
    'profile_photo_path', (SELECT m.storage_path FROM public.media m WHERE m.id = up.profile_media_id),
    'phone_number', up.phone_number,
    'is_active', up.is_active
  )
  INTO v_result
  FROM public.user_profiles up
  WHERE up.id = p_agent_id AND up.role IN ('sales_rep', 'collector');

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_agent_profile(uuid) TO anon;

-- ============================================================
-- 5. verify_agent_login: same body as 2026-10-20b_security_hardening.sql,
--    plus a deactivated check AFTER the password matches (so it can't be
--    used to probe usernames, and doesn't count toward the lockout).
-- ============================================================
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
    IF NOT v_profile.is_active THEN
      RAISE EXCEPTION 'Account deactivated. Contact your manager.';
    END IF;

    DELETE FROM public.login_attempts WHERE username = v_key AND lookup_count = 0;
    UPDATE public.login_attempts
      SET failed_count = 0, first_failed_at = NULL, locked_until = NULL
      WHERE username = v_key;
    RETURN to_jsonb(v_profile) - 'password_hash';
  END IF;

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

COMMIT;

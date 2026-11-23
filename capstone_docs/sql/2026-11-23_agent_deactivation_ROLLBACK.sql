-- Undoes 2026-11-23_agent_deactivation.sql. Reactivates everyone first so no
-- one is left locked out once the login check is gone.
-- Run top to bottom in the Supabase SQL editor.

UPDATE public.user_profiles SET is_active = true, deactivated_at = NULL WHERE is_active = false;

DROP FUNCTION IF EXISTS public.set_agent_active(uuid, boolean);

DROP FUNCTION IF EXISTS public.get_my_agent_accounts();
CREATE FUNCTION public.get_my_agent_accounts()
RETURNS TABLE (
  id uuid,
  username character varying,
  full_name character varying,
  role text,
  branch_ids uuid[],
  created_at timestamptz,
  profile_photo_path text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.username, up.full_name, up.role, up.branch_ids, up.created_at, m.storage_path
  FROM public.user_profiles up
  LEFT JOIN public.media m ON m.id = up.profile_media_id
  WHERE up.created_by = auth.uid()
  ORDER BY up.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_agent_accounts() TO authenticated;

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
    'phone_number', up.phone_number
  )
  INTO v_result
  FROM public.user_profiles up
  WHERE up.id = p_agent_id AND up.role IN ('sales_rep', 'collector');

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_agent_profile(uuid) TO anon;

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

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_active, DROP COLUMN IF EXISTS deactivated_at;

-- Undo 2026-10-20b_security_hardening.sql — puts back the policies, grants
-- and function bodies exactly as they were live on Oct 20. Only for an
-- emergency: this re-opens the security holes that file closes.

-- 1. user_profiles insert policies
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.user_profiles;
CREATE POLICY "Enable insert for authenticated users only" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- 2. activation_keys policies
DROP POLICY IF EXISTS "Anyone can read valid activation keys" ON public.activation_keys;
CREATE POLICY "Anyone can read valid activation keys" ON public.activation_keys
  FOR SELECT USING ((is_used = false) AND ((expires_at IS NULL) OR (expires_at > now())));
DROP POLICY IF EXISTS "Authenticated users can update keys" ON public.activation_keys;
CREATE POLICY "Authenticated users can update keys" ON public.activation_keys
  FOR UPDATE USING ((is_used = false) AND ((expires_at IS NULL) OR (expires_at > now())))
  WITH CHECK ((is_used = true) AND (used_at IS NOT NULL));

DROP FUNCTION IF EXISTS public.check_activation_code(text);
DROP FUNCTION IF EXISTS public.is_username_available(text);

-- 3. activate_manager (Oct 20 live body)
CREATE OR REPLACE FUNCTION public.activate_manager(p_code text, p_user_id uuid, p_username text, p_full_name text)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key public.activation_keys;
  v_profile public.user_profiles;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
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

  UPDATE public.activation_keys
    SET is_used = true, used_at = now(), updated_at = now()
    WHERE id = v_key.id;

  INSERT INTO public.user_profiles (id, username, full_name, email, role, branch_ids)
  VALUES (p_user_id, p_username, p_full_name, v_key.manager_email, 'manager', v_key.branch_ids)
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;
GRANT EXECUTE ON FUNCTION public.activate_manager(text, uuid, text, text) TO PUBLIC, anon, authenticated;

-- 4. verify_agent_login (Oct 20 live body)
DROP FUNCTION IF EXISTS public.verify_agent_login(text, text);
CREATE FUNCTION public.verify_agent_login(p_username text, p_password text)
RETURNS public.user_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT * FROM public.user_profiles
  WHERE username = p_username
    AND password_hash IS NOT NULL
    AND password_hash = crypt(p_password, password_hash)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.verify_agent_login(text, text) TO PUBLIC, anon, authenticated;

-- 5. get_email_by_username (Oct 20 live body)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT email FROM public.user_profiles WHERE username = p_username LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO PUBLIC, anon, authenticated;

DROP TABLE IF EXISTS public.login_attempts;

-- 6. activation_audit_log public insert
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.activation_audit_log;
CREATE POLICY "Anyone can insert audit logs" ON public.activation_audit_log
  FOR INSERT WITH CHECK (true);

-- 7. Internal helpers callable again
DO $$
DECLARE
  v_fn record;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE '\_%' ESCAPE '\' OR p.proname = 'rls_auto_enable')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon, authenticated', v_fn.sig);
  END LOOP;
END;
$$;

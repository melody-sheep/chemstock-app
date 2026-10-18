-- Run in Supabase SQL editor, top to bottom.
--
-- change_agent_password(p_agent_id, p_current_password, p_new_password) —
-- lets a Sales Rep/Collector change their OWN password from Edit Profile,
-- as opposed to reset_agent_password (2026-10-05), which is the *manager*
-- resetting an agent's forgotten password. Same asymmetric pattern as every
-- other agent-vs-manager RPC in this app (see 2026-10-09_profile_phone_number.sql):
-- agents have no Supabase Auth session/auth.uid() to key off of, so this is
-- granted to anon and instead verifies the caller already knows the current
-- password, by re-hashing it with crypt() against the stored hash in the
-- same UPDATE's WHERE clause — if that comparison fails, the UPDATE matches
-- zero rows and the row-count guard (same lesson as
-- 2026-10-09b_phone_number_update_guard.sql) raises a real exception
-- instead of silently doing nothing.
--
-- Managers don't need an RPC for this — they're real Supabase Auth users,
-- so the client re-authenticates with supabase.auth.signInWithPassword()
-- (to verify the current password) then supabase.auth.updateUser() to set
-- the new one, both already provided by supabase-js.
--
-- Strength requirements (length + character classes) mirror
-- ManagerActivationScreen.js's handleCompleteSetup exactly — the same rule
-- the client already enforces on the Change Password screen for every
-- role, repeated here server-side so a client bypass can't skip it.
--
-- extensions schema needed for crypt()/gen_salt() — same gotcha noted in
-- create_agent_account and reset_agent_password.

CREATE OR REPLACE FUNCTION public.change_agent_password(
  p_agent_id uuid, p_current_password text, p_new_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;

  IF p_new_password !~ '[A-Za-z]' THEN
    RAISE EXCEPTION 'Password must contain at least one letter';
  END IF;

  IF p_new_password !~ '[0-9]' THEN
    RAISE EXCEPTION 'Password must contain at least one number';
  END IF;

  IF p_new_password !~ '[!@#$%^&*(),.?":{}|<>_]' THEN
    RAISE EXCEPTION 'Password must contain at least one special character';
  END IF;

  UPDATE public.user_profiles
  SET password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_agent_id
    AND role IN ('sales_rep', 'collector')
    AND password_hash = crypt(p_current_password, password_hash);

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Current password is incorrect';
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_agent_password(uuid, text, text) TO anon;

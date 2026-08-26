-- ============================================================
-- Fix: agent (Sales Rep/Collector) sessions had no real Supabase Auth
-- session to key a fresh profile fetch off of, so branch_ids (and every
-- other profile field) was only ever captured once at login and cached in
-- AsyncStorage forever. Any later admin-side change — e.g. reassigning an
-- agent to a different branch — silently never reached an already-logged-in
-- agent's app until they manually logged out and back in.
--
-- get_agent_profile lets the client re-verify against the database on every
-- getCurrentUser() call instead, degrading gracefully to the cached copy if
-- the agent is offline or no longer exists, rather than breaking the
-- session outright. Same SECURITY DEFINER / GRANT TO anon / re-verify-role
-- pattern as every other agent-facing RPC in this app.
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
    'id', id,
    'username', username,
    'full_name', full_name,
    'role', role,
    'branch_ids', branch_ids
  )
  INTO v_result
  FROM public.user_profiles
  WHERE id = p_agent_id AND role IN ('sales_rep', 'collector');

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_agent_profile(uuid) TO anon;

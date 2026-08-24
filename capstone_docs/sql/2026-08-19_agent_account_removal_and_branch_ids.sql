-- Manage Accounts screen redesign: role-based filtering + Remove Account.
-- Run in Supabase SQL editor.

-- ============================================================
-- 1. get_my_agent_accounts() — CREATE OR REPLACE, now also returns
--    branch_ids so the client can resolve/display branch names per agent
--    (previously omitted). Still explicitly excludes password_hash/email —
--    same "non-sensitive columns only" intent as when this was first
--    written, just with one more safe column added.
-- ============================================================
-- Dropped first: CREATE OR REPLACE cannot change a function's output
-- columns (adding branch_ids here counts as that), so it would otherwise
-- fail with "cannot change return type of existing function."
DROP FUNCTION IF EXISTS public.get_my_agent_accounts();

CREATE FUNCTION public.get_my_agent_accounts()
RETURNS TABLE (
  id uuid,
  username character varying,
  full_name character varying,
  role text,
  branch_ids uuid[],
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, username, full_name, role, branch_ids, created_at
  FROM public.user_profiles
  WHERE created_by = auth.uid()
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_agent_accounts() TO authenticated;

-- ============================================================
-- 2. delete_agent_account(p_agent_id) — permanently deletes an agent's
--    user_profiles row. SECURITY DEFINER, but scoped hard:
--    - caller must be a manager
--    - target row's created_by must be the calling manager (mirrors
--      get_my_agent_accounts' own scoping — a manager can only remove
--      agents they personally created)
--    - target role must be sales_rep/collector — this RPC can never touch
--      a manager row, even if someone tried passing a manager's own id
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_agent_account(p_agent_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Only managers can remove agent accounts';
  END IF;

  DELETE FROM public.user_profiles
  WHERE id = p_agent_id
    AND created_by = auth.uid()
    AND role IN ('sales_rep', 'collector');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'Account not found or you do not have permission to remove it';
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_agent_account(uuid) TO authenticated;

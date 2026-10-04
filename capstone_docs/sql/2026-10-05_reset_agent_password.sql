-- Run in Supabase SQL editor, top to bottom.
--
-- reset_agent_password(p_agent_id, p_new_password) — lets a manager set a
-- brand-new password for a Sales Rep/Collector account they created, for
-- the "agent forgot their password" case. Deliberately a RESET, not a
-- REVEAL: passwords are stored as a one-way bcrypt hash (crypt(...,
-- gen_salt('bf'))) in create_agent_account, so there is no plaintext
-- password anywhere to show the manager even if we wanted to — showing one
-- would mean storing passwords in plaintext, a real security downgrade.
-- The manager relays the new password to the agent out of band (call,
-- chat, in person) after this succeeds.
--
-- SECURITY DEFINER, scoped exactly like delete_agent_account
-- (2026-08-19_agent_account_removal_and_branch_ids.sql):
--   - caller must be a manager
--   - target row's created_by must be the calling manager
--   - target role must be sales_rep/collector — can never touch a manager row
-- extensions schema needed for crypt()/gen_salt() — same gotcha noted in
-- create_agent_account and release_stock_batch.

CREATE OR REPLACE FUNCTION public.reset_agent_password(p_agent_id uuid, p_new_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_updated_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Only managers can reset agent passwords';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 4 THEN
    RAISE EXCEPTION 'Password must be at least 4 characters';
  END IF;

  UPDATE public.user_profiles
  SET password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_agent_id
    AND created_by = auth.uid()
    AND role IN ('sales_rep', 'collector');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'Account not found or you do not have permission to reset its password';
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_agent_password(uuid, text) TO authenticated;

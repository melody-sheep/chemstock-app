-- Run in Supabase SQL editor. Safe to run more than once. Optional:
-- without it the admin tool still works, these actions just aren't saved in
-- the audit log (it prints them in the terminal instead).
--
-- The redesigned admin tool (Oct 20) can also extend keys, deactivate /
-- reactivate managers, change a manager's branches and edit branches. This
-- lets the audit log record those actions too.

ALTER TABLE public.activation_audit_log DROP CONSTRAINT IF EXISTS activation_audit_log_action_check;
ALTER TABLE public.activation_audit_log ADD CONSTRAINT activation_audit_log_action_check
  CHECK (action = ANY (ARRAY[
    'validate_key', 'activate_manager', 'generate_key', 'revoke_key',
    'extend_key', 'deactivate_manager', 'reactivate_manager', 'update_manager_branches', 'update_branch'
  ]));

-- Undo:
-- ALTER TABLE public.activation_audit_log DROP CONSTRAINT IF EXISTS activation_audit_log_action_check;
-- ALTER TABLE public.activation_audit_log ADD CONSTRAINT activation_audit_log_action_check
--   CHECK (action = ANY (ARRAY['validate_key', 'activate_manager', 'generate_key', 'revoke_key']));

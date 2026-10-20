-- Run in Supabase SQL editor. Safe to run more than once.
-- To undo: 2026-10-20e_admin_activity_log_ROLLBACK.sql
--
-- Admin activity log (Oct 20): who used the admin tool and what they did —
-- logins, failed logins, keys created / revoked / extended, managers
-- deactivated, branches changed, codes revealed or copied, exports. Kept for
-- accountability and security, developers included.
--
-- One shared table, so every developer's laptop writes to the same log.
-- Append-only: rows can't be edited or deleted (a trigger refuses). Nothing
-- in the mobile app reads or writes it. Until this is run, the admin tool
-- keeps the same log in a local file (admin-cli/logs/admin-activity.jsonl).

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_name text NOT NULL,
  machine    text,
  ip_address text,
  action     text NOT NULL,
  target     text,
  details    jsonb,
  status     text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS admin_activity_log_created_at_idx ON public.admin_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_activity_log_admin_idx ON public.admin_activity_log (admin_name);

-- Only the admin tool (service role) touches it; the app's public key can't.
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_activity_log FROM PUBLIC, anon, authenticated;

-- Append-only.
CREATE OR REPLACE FUNCTION public._admin_activity_log_readonly()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'The admin activity log cannot be changed or deleted';
END;
$$;
REVOKE ALL ON FUNCTION public._admin_activity_log_readonly() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS admin_activity_log_readonly ON public.admin_activity_log;
CREATE TRIGGER admin_activity_log_readonly
  BEFORE UPDATE OR DELETE ON public.admin_activity_log
  FOR EACH ROW EXECUTE FUNCTION public._admin_activity_log_readonly();

-- Run in the Supabase SQL editor, top to bottom.
--
-- Presence: lets the map show whether a Sales Rep or Collector is online, and
-- when they were last online. Each app writes last_seen_at while it is active
-- (throttled to about once every two minutes), and the map reads it back.
--
-- Sales Reps and Collectors have no Supabase Auth session (their client is
-- anon), so the write function takes the agent id explicitly, like the other
-- agent RPCs. Managers are authenticated, so the write uses auth.uid() when no
-- id is passed.
--
-- Limitation: since agents aren't authenticated, a caller who knows an agent's
-- id could record a fake "seen" time for them. That only affects the status
-- shown on the map, not any stock or money data.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone;

-- Records that this person's app was active just now.
CREATE OR REPLACE FUNCTION public.touch_presence(p_agent_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := COALESCE(p_agent_id, auth.uid());
BEGIN
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.user_profiles
    SET last_seen_at = now()
    WHERE id = v_id
      AND role IN ('manager', 'sales_rep', 'collector');
END;
$$;

-- Reads last_seen_at for a list of people. Returns only id and time, nothing else.
CREATE OR REPLACE FUNCTION public.get_presence(p_ids uuid[])
RETURNS TABLE (id uuid, last_seen_at timestamp with time zone)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.last_seen_at
  FROM public.user_profiles up
  WHERE up.id = ANY(p_ids);
$$;

GRANT EXECUTE ON FUNCTION public.touch_presence(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_presence(uuid[]) TO anon, authenticated;

-- Refresh PostgREST so the new functions are callable right away.
NOTIFY pgrst, 'reload schema';

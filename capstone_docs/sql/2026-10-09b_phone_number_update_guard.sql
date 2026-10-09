-- update_agent_phone_number / update_manager_phone_number (from
-- 2026-10-09_profile_phone_number.sql) returned a success response even
-- when their UPDATE matched zero rows — Postgres never errors on a 0-row
-- UPDATE, it just silently no-ops. That produced exactly the symptom seen
-- in testing: the app shows no error, but user_profiles.phone_number never
-- actually changes. This adds a row-count check so a 0-row update now
-- raises a real, visible exception instead of lying about success.
-- Safe CREATE OR REPLACE: same signatures/return type as before.
-- Run in Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.update_agent_phone_number(
  p_agent_id uuid, p_phone_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role IN ('sales_rep','collector')) THEN
    RAISE EXCEPTION 'Invalid agent (id %)', p_agent_id;
  END IF;

  UPDATE public.user_profiles SET phone_number = NULLIF(btrim(p_phone_number), '') WHERE id = p_agent_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Phone number update matched no rows (agent id %)', p_agent_id;
  END IF;

  RETURN jsonb_build_object('phoneNumber', p_phone_number, 'rowsUpdated', v_rows);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_agent_phone_number(uuid, text) TO anon;

CREATE OR REPLACE FUNCTION public.update_manager_phone_number(
  p_phone_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager') THEN
    RAISE EXCEPTION 'Not authorized (auth.uid() %)', auth.uid();
  END IF;

  UPDATE public.user_profiles SET phone_number = NULLIF(btrim(p_phone_number), '') WHERE id = auth.uid();
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Phone number update matched no rows (auth.uid() %)', auth.uid();
  END IF;

  RETURN jsonb_build_object('phoneNumber', p_phone_number, 'rowsUpdated', v_rows);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_manager_phone_number(text) TO authenticated;

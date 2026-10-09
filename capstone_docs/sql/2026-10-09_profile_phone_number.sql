-- ============================================================
-- Edit Profile Phone Number — Manager, Sales Rep, Collector
-- Same shape as 2026-08-27_profile_photo.sql: one column on user_profiles,
-- two RPCs following the established agent-vs-manager asymmetric pattern
-- (agents are always anon, no auth.uid() to key off of; managers are real
-- Supabase Auth sessions), and get_agent_profile gains the new field so
-- EditProfileScreen's agent-side getCurrentUser() refresh picks it up.
-- Run in Supabase SQL editor.
-- ============================================================

-- ============================================================
-- 1. user_profiles.phone_number
-- ============================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone_number text;

-- ============================================================
-- 2. Two RPCs, mirroring update_agent_profile_photo /
--    update_manager_profile_photo exactly (including letting an empty
--    string through so a phone number can be cleared, same as every other
--    optional text field in this app).
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_agent_phone_number(
  p_agent_id uuid, p_phone_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role IN ('sales_rep','collector')) THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  UPDATE public.user_profiles SET phone_number = NULLIF(btrim(p_phone_number), '') WHERE id = p_agent_id;

  RETURN jsonb_build_object('phoneNumber', p_phone_number);
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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.user_profiles SET phone_number = NULLIF(btrim(p_phone_number), '') WHERE id = auth.uid();

  RETURN jsonb_build_object('phoneNumber', p_phone_number);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_manager_phone_number(text) TO authenticated;

-- ============================================================
-- 3. get_agent_profile gains phone_number — safe CREATE OR REPLACE since
--    the return type (jsonb) and argument list are both unchanged.
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

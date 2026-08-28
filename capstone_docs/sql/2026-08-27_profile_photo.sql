-- ============================================================
-- Edit Profile Picture — Manager, Sales Rep, Collector
-- ============================================================

-- ============================================================
-- 1. user_profiles.profile_media_id — reuses the existing media table
--    (one row per uploaded photo) rather than a new table. A photo change
--    inserts a NEW media row and repoints this FK; the old row is simply
--    left unreferenced, same "no explicit cleanup on replace" behavior
--    already accepted elsewhere in this app.
-- ============================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS profile_media_id uuid REFERENCES public.media(id);

-- ============================================================
-- 2. Storage policies — new profile-photos/ prefix in the existing
--    shipment-media bucket (no new bucket). Prefix-only trust, same as
--    sr-acceptances/ and sr-discrepancy-resolutions/ — the RPC re-verifies
--    identity server-side, not the storage policy.
-- ============================================================
CREATE POLICY "Agents can upload their own profile photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'shipment-media' AND (storage.foldername(name))[1] = 'profile-photos');

CREATE POLICY "Agents can view profile photos"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'shipment-media' AND (storage.foldername(name))[1] = 'profile-photos');

CREATE POLICY "Managers can upload their own profile photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shipment-media' AND (storage.foldername(name))[1] = 'profile-photos');

CREATE POLICY "Managers can view profile photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shipment-media' AND (storage.foldername(name))[1] = 'profile-photos');

-- Every existing media SELECT policy in this app is scoped through a
-- specific parent table (receiving_batches/transactions/stock_acceptances/
-- discrepancy_resolutions) — none of them cover a user_profiles.media
-- embed. Without this, a Manager's own profile photo would silently come
-- back null (RLS filters, no error) the moment authService.js embeds
-- media:profile_media_id(...) on their own user_profiles row. Scoped
-- narrowly to "your own current profile photo only", not a blanket
-- "any media you uploaded" grant.
CREATE POLICY "Managers can view their own profile photo media"
  ON public.media FOR SELECT TO authenticated
  USING (id IN (SELECT profile_media_id FROM public.user_profiles WHERE id = auth.uid()));

-- ============================================================
-- 3. Two RPCs, following the established agent-vs-manager asymmetric
--    pattern (submit_daily_report / accept_daily_report) exactly.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_agent_profile_photo(
  p_agent_id uuid, p_storage_path text, p_device_model text, p_device_os text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_media_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role IN ('sales_rep','collector')) THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;
  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'A photo is required';
  END IF;

  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, p_agent_id) RETURNING id INTO v_media_id;

  UPDATE public.user_profiles SET profile_media_id = v_media_id WHERE id = p_agent_id;

  RETURN jsonb_build_object('mediaId', v_media_id, 'storagePath', p_storage_path);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_agent_profile_photo(uuid, text, text, text) TO anon;

CREATE OR REPLACE FUNCTION public.update_manager_profile_photo(
  p_storage_path text, p_device_model text, p_device_os text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_media_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN
    RAISE EXCEPTION 'A photo is required';
  END IF;

  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
    VALUES (p_storage_path, p_device_model, p_device_os, auth.uid()) RETURNING id INTO v_media_id;

  UPDATE public.user_profiles SET profile_media_id = v_media_id WHERE id = auth.uid();

  RETURN jsonb_build_object('mediaId', v_media_id, 'storagePath', p_storage_path);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_manager_profile_photo(text, text, text) TO authenticated;

-- ============================================================
-- 4. get_agent_profile gains profile_photo_path — safe CREATE OR REPLACE
--    since the return type (jsonb) and argument list are both unchanged.
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
    'profile_photo_path', (SELECT m.storage_path FROM public.media m WHERE m.id = up.profile_media_id)
  )
  INTO v_result
  FROM public.user_profiles up
  WHERE up.id = p_agent_id AND up.role IN ('sales_rep', 'collector');

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_agent_profile(uuid) TO anon;

-- Run in Supabase SQL editor.
--
-- Fixes "[StorageApiError: Object not found]" when a manager opens a
-- submitted daily report's handover photo (ManageReturnsScreen.js).
--
-- Root cause: 2026-10-04_release_branch_photo_discrepancy_branch.sql added a
-- storage.objects SELECT policy for managers that joins through
-- public.media, but skipped the matching public.media SELECT policy itself
-- (its own comment said this was fine because get_branch_daily_reports is
-- SECURITY DEFINER and bypasses RLS — true for that RPC, but irrelevant to
-- the separate client-side createSignedUrl() call reportService.js's
-- getDailyReportPhotoUrl makes directly against storage.objects, which
-- still evaluates the nested public.media subquery under the manager's own
-- RLS). With no policy covering daily-report media rows, that subquery
-- returns zero rows, the storage policy denies access, and Supabase
-- obfuscates the denial as "Object not found" — indistinguishable
-- client-side from a genuinely missing file.
--
-- Every other photo feature in this app (receiving, release, stock
-- acceptance, discrepancy resolution, profile photos) already pairs its
-- storage.objects policy with a matching public.media policy — this was
-- the one gap. Same shape as those.

CREATE POLICY "Managers can view daily report media rows for their branches"
  ON public.media FOR SELECT TO authenticated
  USING (id IN (
    SELECT dr.media_id FROM public.daily_reports dr
    WHERE dr.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  ));

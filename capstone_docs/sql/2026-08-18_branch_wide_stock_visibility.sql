-- Sprint 1.2: branch-wide stock visibility for managers
-- Run in Supabase SQL editor before testing the new Stocks/Logs screens.
--
-- Context: branch_inventory/receiving_batches/gps_coordinates/media were
-- originally RLS-scoped to the row's own received_by/captured_by/uploaded_by
-- (i.e. only the manager who personally ran Receive Stock could see it).
-- Jay decided the Stocks screen should show the whole branch's inventory
-- (matches the "Branch Inventory" label in the mockup), so this ADDS a
-- second, branch-scoped SELECT policy alongside the existing owner-scoped
-- one on each table. Postgres ORs permissive policies of the same command
-- together, so nothing that worked before stops working — a manager now
-- sees a row if they received it themselves OR if it belongs to a branch
-- listed in their own user_profiles.branch_ids.

CREATE POLICY "Managers can view branch inventory for their branches"
  ON public.branch_inventory FOR SELECT
  TO authenticated
  USING (
    branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers can view receiving batches for their branches"
  ON public.receiving_batches FOR SELECT
  TO authenticated
  USING (
    branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Managers can view gps for their branches' receiving batches"
  ON public.gps_coordinates FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT gps_id FROM public.receiving_batches
      WHERE gps_id IS NOT NULL
        AND branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Managers can view media for their branches' receiving batches"
  ON public.media FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT media_id FROM public.receiving_batches
      WHERE media_id IS NOT NULL
        AND branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
    )
  );

-- Storage: shipment photos are stored under a per-uploader folder
-- (<uploader_id>/<timestamp>.jpg), so branch-wide DB visibility alone
-- doesn't let a teammate view the actual photo file. This adds branch-wide
-- read access on top of the existing per-uploader-folder policy.
CREATE POLICY "Managers can view shipment media for their branches"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'shipment-media'
    AND name IN (
      SELECT m.storage_path FROM public.media m
      JOIN public.receiving_batches rb ON rb.media_id = m.id
      WHERE rb.branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
    )
  );

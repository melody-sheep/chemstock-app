-- ============================================================================
-- 2026-10-11b_delivery_handoff_qr_ROLLBACK.sql
-- Reverses 2026-10-11b_delivery_handoff_qr.sql. Safe to run — all changes
-- are additive (columns nullable, functions CREATE OR REPLACE'able back).
-- ============================================================================

-- 1. Drop the QR-enabled confirm RPC. Re-run
--    2026-10-11_delivery_handoff_confirmation.sql afterward to restore it.
DROP FUNCTION IF EXISTS public.confirm_delivery_handoff(
  uuid, uuid, double precision, double precision, text, text, text, text
);

-- 2. Drop the extended dispute RPC. Re-run
--    2026-10-11_delivery_handoff_confirmation.sql afterward to restore it.
DROP FUNCTION IF EXISTS public.dispute_delivery_handoff(
  uuid, uuid, text, text, text, text, text
);

-- 3. Drop get_my_pending_handoffs.
DROP FUNCTION IF EXISTS public.get_my_pending_handoffs(uuid);

-- 4. Drop the new index.
DROP INDEX IF EXISTS public.delivery_handoffs_sr_status_created_idx;

-- 5. Drop the new columns (safe — they're nullable / have defaults).
ALTER TABLE public.delivery_handoffs
  DROP COLUMN IF EXISTS sr_scanned_qr_code,
  DROP COLUMN IF EXISTS sr_photo_is_damage_report;

-- 6. Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload schema';

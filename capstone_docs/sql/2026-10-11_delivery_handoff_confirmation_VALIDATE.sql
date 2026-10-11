-- ============================================================================
-- 2026-10-11_delivery_handoff_confirmation_VALIDATE.sql
-- Run AFTER the migration. Every query should return the expected result
-- shown in the comment above it. Paste the full output back to confirm.
-- ============================================================================


-- [1] delivery_handoffs table exists
--     EXPECTED: 1 row, 11 columns listed
SELECT 'delivery_handoffs table exists' AS check_name,
       COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'delivery_handoffs';


-- [2] delivery_handoffs columns match the design
--     EXPECTED: 11 rows: id, transaction_id, collector_id, sr_id,
--     collector_claimed_at, sr_confirmed_at, gps_id, media_id,
--     distance_meters, handoff_status, dispute_reason, created_at (12 actually)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'delivery_handoffs'
ORDER BY ordinal_position;


-- [3] notifications.type CHECK constraint now has 10 values
--     EXPECTED: 1 row containing 'delivery_handoff_pending_sr',
--     'delivery_handoff_confirmed', 'delivery_handoff_disputed'
SELECT pg_get_constraintdef(oid) AS notifications_type_check
FROM pg_constraint
WHERE conname = 'notifications_type_check';


-- [4] sr_inventory.acceptance_id is now nullable
--     EXPECTED: is_nullable = 'YES'
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sr_inventory'
  AND column_name IN ('acceptance_id', 'handoff_id')
ORDER BY column_name;


-- [5] sr_inventory_source_check constraint exists
--     EXPECTED: 1 row showing the XOR check
SELECT pg_get_constraintdef(oid) AS sr_inventory_source_check
FROM pg_constraint
WHERE conname = 'sr_inventory_source_check';


-- [6] confirm_delivery_handoff RPC exists
--     EXPECTED: 1 row with the full signature
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'confirm_delivery_handoff';


-- [7] dispute_delivery_handoff RPC exists
--     EXPECTED: 1 row with the full signature
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'dispute_delivery_handoff';


-- [8] finish_delivery_leg RPC still has its original signature
--     EXPECTED: 1 row, 5 args (uuid, uuid, double precision,
--     double precision, text) — unchanged from before
SELECT proname, pg_get_function_arguments(oid) AS args
FROM pg_proc
WHERE proname = 'finish_delivery_leg';


-- [9] RLS enabled on delivery_handoffs
--     EXPECTED: 1 row, relrowsecurity = true
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'delivery_handoffs';


-- [10] RLS policies on delivery_handoffs
--      EXPECTED: 1 row (manager-select policy)
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'delivery_handoffs';


-- [11] stock_acceptances.transaction_id UNIQUE constraint UNCHANGED
--      EXPECTED: 1 row still showing the UNIQUE constraint
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.stock_acceptances'::regclass
  AND contype = 'u';

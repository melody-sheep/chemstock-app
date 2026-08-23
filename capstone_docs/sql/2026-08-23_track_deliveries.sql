-- Adds the groundwork for "Track Deliveries": a delivery_status field on
-- collector-mediated transactions (Not Delivered / Delivered — only settable
-- by the Collector confirming receipt, which is a future session's work; for
-- now every collector release simply starts as 'not_delivered'), and an
-- event-log table for the Collector's future "press a button to log where I
-- am right now" location updates (explicitly NOT continuous/live tracking —
-- Jay's own framing: "works similarly to Shopee's delivery status", i.e. a
-- handful of discrete checkpoints per delivery, not a GPS stream).
--
-- Nothing writes to delivery_checkpoints yet (no Collector-side button
-- exists), and nothing flips delivery_status to 'delivered' yet (no
-- Collector-side "mark delivered" exists) — this migration only adds the
-- schema + read (SELECT) access so the Manager's Track Deliveries screen has
-- something real to query today, ready for both write paths to land later
-- as SECURITY DEFINER RPCs (the same reason verify_agent_login/
-- create_agent_account exist: Collector accounts have no real Supabase Auth
-- session, so auth.uid() is never the Collector — any future write RPC for
-- either of these must take the collector's identity as an explicit
-- parameter, not rely on auth.uid()).

-- ============================================================
-- 1. delivery_status — only meaningful for movement_type = 'collector'
--    (a direct Sales Rep release has no separate delivery step; the release
--    IS the handover). Populated by a BEFORE INSERT trigger, same pattern as
--    received_quantity/set_received_quantity from the 2026-08-21 migration,
--    so release_stock_batch's own source doesn't need touching again.
-- ============================================================
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS delivery_status text
  CHECK (delivery_status IN ('not_delivered', 'delivered'));

-- Backfill existing rows before the invariant constraint below can be
-- added — any collector release from earlier testing still has
-- delivery_status = NULL (the trigger only populates it for new inserts),
-- which would otherwise violate the constraint immediately.
UPDATE public.transactions SET delivery_status = 'not_delivered'
  WHERE movement_type = 'collector' AND delivery_status IS NULL;

CREATE OR REPLACE FUNCTION public.set_delivery_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.movement_type = 'collector' THEN
    NEW.delivery_status := 'not_delivered';
  ELSE
    NEW.delivery_status := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_delivery_status ON public.transactions;
CREATE TRIGGER trg_set_delivery_status
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivery_status();

-- Invariant, same shape as the destination_gps_id/target_recipient_id check
-- from the previous migration: delivery_status set iff movement_type = 'collector'.
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_delivery_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_delivery_status_check
  CHECK (
    (movement_type = 'direct'    AND delivery_status IS NULL)
    OR
    (movement_type = 'collector' AND delivery_status IS NOT NULL)
  );

-- ============================================================
-- 2. delivery_checkpoints — one row per future button-press location update.
--    captured_by is a Collector's user_profiles.id, which will never equal
--    auth.uid() (Collectors have no Supabase Auth session at all) — so
--    unlike gps_coordinates/media, there is no "owner-scoped" RLS policy
--    here to mirror. Only a branch-scoped SELECT policy is added, which is
--    all the Manager's viewing screen needs; the future write RPC will run
--    SECURITY DEFINER and bypass RLS entirely for its own INSERT, the same
--    way create_agent_account does today.
-- ============================================================
CREATE TABLE public.delivery_checkpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  captured_by uuid NOT NULL REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_checkpoints_pkey PRIMARY KEY (id)
);
CREATE INDEX ON public.delivery_checkpoints (transaction_id);
CREATE INDEX ON public.delivery_checkpoints (created_at DESC);

ALTER TABLE public.delivery_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view checkpoints for their branches' deliveries"
  ON public.delivery_checkpoints FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions
      WHERE branch_id IN (SELECT UNNEST(branch_ids) FROM public.user_profiles WHERE id = auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policies — same as every other write path in this
-- app, checkpoint logging will go through a SECURITY DEFINER RPC once the
-- Collector-side button is built, not direct client writes.

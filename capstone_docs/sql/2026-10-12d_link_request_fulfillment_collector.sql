-- 2026-10-12d_link_request_fulfillment_collector.sql
-- Run in the Supabase SQL editor, top to bottom. Safe to re-run.
--
-- link_request_fulfillment only accepted a release whose received_by is the
-- requesting Sales Rep. That is true for a direct release, but a release via
-- a Collector has received_by = the Collector and target_recipient_id = the
-- Sales Rep — so a request fulfilled through a Collector always failed with
-- "Transaction recipient does not match the requesting Sales Rep" and stayed
-- "Preparing" forever (seen on device Oct 12, request acd37b0a).
--
-- Body copied from 2026-08-24_stock_requests.sql (its only definition),
-- unchanged except the recipient check now also accepts target_recipient_id.

CREATE OR REPLACE FUNCTION public.link_request_fulfillment(p_request_id uuid, p_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.stock_requests;
  v_txn public.transactions;
BEGIN
  SELECT * INTO v_req FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'manager' AND v_req.branch_id = ANY(branch_ids)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  IF v_req.status <> 'accepted' THEN
    RAISE EXCEPTION 'Request must be accepted before it can be linked to a release (current status: %)', v_req.status;
  END IF;
  IF v_req.fulfilled_transaction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Request is already linked to a release';
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_txn.branch_id <> v_req.branch_id THEN
    RAISE EXCEPTION 'Transaction branch does not match the request''s branch';
  END IF;
  IF v_txn.released_by <> auth.uid() THEN
    RAISE EXCEPTION 'Transaction was not released by you';
  END IF;
  -- Direct: handed straight to the Sales Rep. Collector: the Sales Rep is
  -- the delivery's target recipient.
  IF v_txn.received_by <> v_req.requested_by
     AND v_txn.target_recipient_id IS DISTINCT FROM v_req.requested_by THEN
    RAISE EXCEPTION 'Transaction recipient does not match the requesting Sales Rep';
  END IF;

  UPDATE public.stock_requests SET fulfilled_transaction_id = p_transaction_id WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_request_fulfillment(uuid, uuid) TO authenticated;

-- One-time repair: link the release made at 8:17 PM on Oct 12 to its request
-- (same branch, same Sales Rep as target — it only failed the old check).
UPDATE public.stock_requests
SET fulfilled_transaction_id = 'dca5c92f-82ec-464f-a24a-94c656b261b7'
WHERE id = 'acd37b0a-3500-4d4a-937c-6d6b875a02d3'
  AND fulfilled_transaction_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = 'dca5c92f-82ec-464f-a24a-94c656b261b7'
      AND t.branch_id = stock_requests.branch_id
      AND t.target_recipient_id = stock_requests.requested_by
  );

NOTIFY pgrst, 'reload schema';

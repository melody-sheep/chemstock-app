-- Run in the Supabase SQL editor, top to bottom (after 2026-10-06_presence_last_seen.sql).
--
-- get_delivery_parties(agent, transaction): returns the collector and the
-- Sales Rep on one collector delivery, with their profile photo paths and
-- last-seen times, so the Sales Rep and collector maps can show who is who.
--
-- Only the two people on that delivery can read it: the agent must be the
-- collector who received the delivery, or the Sales Rep it is for. Returns
-- nothing else (no branch, stock, or contact data).

CREATE OR REPLACE FUNCTION public.get_delivery_parties(p_agent_id uuid, p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn public.transactions;
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_agent_id AND role IN ('sales_rep', 'collector')) THEN
    RAISE EXCEPTION 'Invalid agent';
  END IF;

  SELECT * INTO v_txn FROM public.transactions WHERE id = p_transaction_id;
  IF NOT FOUND OR v_txn.movement_type <> 'collector' THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;
  IF p_agent_id NOT IN (v_txn.received_by, v_txn.target_recipient_id) THEN
    RAISE EXCEPTION 'Not your delivery';
  END IF;

  SELECT jsonb_build_object(
    'collector', (
      SELECT jsonb_build_object('id', up.id, 'fullName', up.full_name, 'photoPath', m.storage_path, 'lastSeenAt', up.last_seen_at)
      FROM public.user_profiles up
      LEFT JOIN public.media m ON m.id = up.profile_media_id
      WHERE up.id = v_txn.received_by
    ),
    'salesRep', (
      SELECT jsonb_build_object('id', up.id, 'fullName', up.full_name, 'photoPath', m.storage_path, 'lastSeenAt', up.last_seen_at)
      FROM public.user_profiles up
      LEFT JOIN public.media m ON m.id = up.profile_media_id
      WHERE up.id = v_txn.target_recipient_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_delivery_parties(uuid, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

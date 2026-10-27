-- REFERENCE ONLY. Do NOT run this file; it is a copy of what is already live in Supabase.
-- Exported on 2026-10-27 with pg_get_functiondef() for TODO item BL-4: these five functions were used by the app
-- but were not in the repo, so the database could not have been rebuilt from the repo alone.
--
-- Review notes (found while exporting):
--   * receive_stock_batch: no expiry check (BL-5) and it does not check that the manager belongs to p_branch_id.
--   * get_branch_stock_for_agent: trusts the p_agent_id it is given (same issue as P0-5).
--   * create_agent_account: no server-side password rule (the app enforces 4+ characters, see SEC-4).
--   * verify_agent_login: good (5 wrong passwords lock a username for 15 minutes; the hash is not returned).
--   * activate_manager: good (the code works only for the email it was issued to).

CREATE OR REPLACE FUNCTION public.activate_manager(p_code text, p_user_id uuid, p_username text, p_full_name text)
 RETURNS user_profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key public.activation_keys;
  v_profile public.user_profiles;
  v_email text := lower(COALESCE(auth.jwt() ->> 'email', ''));
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'This account is already activated. Log in instead.';
  END IF;

  IF p_username IS NULL OR length(trim(p_username)) < 3 THEN
    RAISE EXCEPTION 'Please enter a username of at least 3 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE lower(username) = lower(trim(p_username))) THEN
    RAISE EXCEPTION 'That username is already taken. Please choose another.';
  END IF;

  SELECT * INTO v_key FROM public.activation_keys
    WHERE code = p_code AND is_used = false
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already-used activation code';
  END IF;

  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RAISE EXCEPTION 'Activation code has expired';
  END IF;

  -- A code only works for the email it was issued to.
  IF lower(trim(v_key.manager_email)) <> v_email THEN
    RAISE EXCEPTION 'This activation code was issued for a different email';
  END IF;

  UPDATE public.activation_keys
    SET is_used = true, used_at = now(), updated_at = now()
    WHERE id = v_key.id;

  INSERT INTO public.user_profiles (id, username, full_name, email, role, branch_ids)
  VALUES (p_user_id, trim(p_username), p_full_name, v_key.manager_email, 'manager', v_key.branch_ids)
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_agent_account(p_username text, p_full_name text, p_password text, p_role text, p_branch_ids uuid[])
 RETURNS user_profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_profile public.user_profiles;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Only a manager can create agent accounts';
  END IF;

  IF p_role NOT IN ('sales_rep', 'collector') THEN
    RAISE EXCEPTION 'Invalid role for an agent account';
  END IF;

  INSERT INTO public.user_profiles (id, username, full_name, email, role, branch_ids, password_hash, created_by)
  VALUES (
    gen_random_uuid(),
    p_username,
    p_full_name,
    p_username || '@chemstock.local',
    p_role,
    p_branch_ids,
    crypt(p_password, gen_salt('bf')),
    auth.uid()
  )
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_branch_stock_for_agent(p_agent_id uuid)
 RETURNS SETOF branch_inventory
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT bi.*
  FROM public.branch_inventory bi
  WHERE bi.branch_id IN (
    SELECT UNNEST(up.branch_ids)
    FROM public.user_profiles up
    WHERE up.id = p_agent_id
      AND up.role IN ('sales_rep', 'collector')
  )
  ORDER BY bi.exp_date ASC NULLS LAST;
$function$;

CREATE OR REPLACE FUNCTION public.receive_stock_batch(p_branch_id uuid, p_latitude double precision, p_longitude double precision, p_storage_path text, p_device_model text, p_device_os text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gps_id uuid;
  v_media_id uuid;
  v_batch_id uuid;
  v_qr_code text;
  v_item jsonb;
  v_inventory_rows jsonb := '[]'::jsonb;
  v_row public.branch_inventory;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Only managers can register incoming stock';
  END IF;

  INSERT INTO public.gps_coordinates (latitude, longitude, captured_by)
  VALUES (p_latitude, p_longitude, auth.uid())
  RETURNING id INTO v_gps_id;

  INSERT INTO public.media (storage_path, device_model, device_os, uploaded_by)
  VALUES (p_storage_path, p_device_model, p_device_os, auth.uid())
  RETURNING id INTO v_media_id;

  v_qr_code := 'RCV-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 6);

  INSERT INTO public.receiving_batches (branch_id, qr_code, gps_id, media_id, received_by)
  VALUES (p_branch_id, v_qr_code, v_gps_id, v_media_id, auth.uid())
  RETURNING id INTO v_batch_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.branch_inventory (
      receiving_batch_id, branch_id, product_code, product_name,
      batch_number, quantity, mfg_date, exp_date, received_by
    ) VALUES (
      v_batch_id, p_branch_id,
      v_item->>'product_code', v_item->>'product_name',
      'BN-' || upper(v_item->>'product_code') || '-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4),
      (v_item->>'quantity')::integer,
      NULLIF(v_item->>'mfg_date', '')::date,
      NULLIF(v_item->>'exp_date', '')::date,
      auth.uid()
    )
    RETURNING * INTO v_row;
    v_inventory_rows := v_inventory_rows || to_jsonb(v_row);
  END LOOP;

  RETURN jsonb_build_object('qrCode', v_qr_code, 'batchId', v_batch_id, 'items', v_inventory_rows);
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_agent_login(p_username text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_key text := lower(trim(COALESCE(p_username, '')));
  v_attempt public.login_attempts;
  v_profile public.user_profiles;
  v_is_agent boolean;
  c_max_failures constant integer := 5;
  c_window constant interval := interval '15 minutes';
  c_lock constant interval := interval '15 minutes';
BEGIN
  IF v_key = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_attempt FROM public.login_attempts WHERE username = v_key;
  IF FOUND AND v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > now() THEN
    RAISE EXCEPTION 'Too many failed attempts. Try again in % minute(s).',
      GREATEST(1, ceil(extract(epoch FROM (v_attempt.locked_until - now())) / 60)::integer);
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles
    WHERE username = trim(p_username)
      AND password_hash IS NOT NULL
      AND password_hash = crypt(p_password, password_hash)
    LIMIT 1;

  IF FOUND THEN
    DELETE FROM public.login_attempts WHERE username = v_key AND lookup_count = 0;
    UPDATE public.login_attempts
      SET failed_count = 0, first_failed_at = NULL, locked_until = NULL
      WHERE username = v_key;
    RETURN to_jsonb(v_profile) - 'password_hash';
  END IF;

  -- Only Sales Rep / Collector usernames count toward the lock. Managers sign
  -- in with Supabase Auth (which has its own limits); the app tries this
  -- function first for every login, so counting them would lock managers out.
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE username = trim(p_username) AND password_hash IS NOT NULL
  ) INTO v_is_agent;

  IF v_is_agent THEN
    INSERT INTO public.login_attempts (username, failed_count, first_failed_at)
      VALUES (v_key, 1, now())
    ON CONFLICT (username) DO UPDATE SET
      failed_count = CASE
        WHEN public.login_attempts.first_failed_at IS NULL
          OR public.login_attempts.first_failed_at < now() - c_window THEN 1
        ELSE public.login_attempts.failed_count + 1 END,
      first_failed_at = CASE
        WHEN public.login_attempts.first_failed_at IS NULL
          OR public.login_attempts.first_failed_at < now() - c_window THEN now()
        ELSE public.login_attempts.first_failed_at END,
      locked_until = NULL;

    UPDATE public.login_attempts
      SET locked_until = now() + c_lock
      WHERE username = v_key AND failed_count >= c_max_failures;
  END IF;

  RETURN NULL;
END;
$function$;

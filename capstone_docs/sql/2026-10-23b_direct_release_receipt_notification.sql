-- Make Manager notifications for direct releases explicit about QR receipt
-- and the stock being added to the Sales Rep's backpack.
-- Collector acceptance notifications keep their existing wording.

BEGIN;

CREATE OR REPLACE FUNCTION public._trg_notify_stock_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released_by uuid;
  v_name text;
  v_movement_type text;
  v_title text;
  v_body text;
BEGIN
  SELECT released_by, movement_type
    INTO v_released_by, v_movement_type
    FROM public.transactions
    WHERE id = NEW.transaction_id;

  SELECT full_name
    INTO v_name
    FROM public.user_profiles
    WHERE id = NEW.accepted_by;

  IF v_movement_type = 'direct' THEN
    v_title := 'Direct release received';
    v_body := COALESCE(v_name, 'The Sales Rep')
      || ' scanned the release QR and accepted the stock. It has been added to their backpack.';
  ELSE
    v_title := 'Stock accepted';
    v_body := COALESCE(v_name, 'The recipient') || ' accepted the stock you released.';
  END IF;

  PERFORM public._notify(
    v_released_by, 'stock_accepted', v_title, v_body,
    'StockLogs', jsonb_build_object('focusId', NEW.transaction_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_stock_accepted ON public.stock_acceptances;
CREATE TRIGGER trg_notify_stock_accepted
  AFTER INSERT ON public.stock_acceptances
  FOR EACH ROW EXECUTE FUNCTION public._trg_notify_stock_accepted();

COMMIT;

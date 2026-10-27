-- Undoes 2026-10-28b_nudge_sales_rep.sql.
-- Step 1 deletes the reminder notifications themselves (only rows of type 'report_reminder'; nothing else), because the
-- type cannot be removed from the list while such rows exist. Run it only if you really want the nudge gone.

DROP FUNCTION IF EXISTS public.nudge_report_item(uuid);

DELETE FROM public.notifications WHERE type = 'report_reminder';

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint
   WHERE conname = 'notifications_type_check' AND conrelid = 'public.notifications'::regclass;
  IF v_def IS NULL OR position('''report_reminder''' IN v_def) = 0 THEN
    RETURN;
  END IF;
  v_def := replace(v_def, '''report_reminder''::text, ', '');
  ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
  EXECUTE 'ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check ' || v_def;
END $$;

NOTIFY pgrst, 'reload schema';

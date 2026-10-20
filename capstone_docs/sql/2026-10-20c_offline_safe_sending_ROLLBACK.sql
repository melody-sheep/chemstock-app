-- Undo 2026-10-20c_offline_safe_sending.sql. Only adds were made, so this just
-- removes them; every original function was never touched. The 1.0.7 app
-- falls back to the original functions when the "_once" ones are missing.

DROP FUNCTION IF EXISTS public.submit_daily_report_once(uuid, uuid, double precision, double precision, text, text, text, jsonb, date);
DROP FUNCTION IF EXISTS public._file_overdue_sr_reports_until(uuid, date);
DROP FUNCTION IF EXISTS public.finish_delivery_leg_once(uuid, uuid, uuid, double precision, double precision, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.log_delivery_checkpoint_once(uuid, uuid, uuid, double precision, double precision, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.request_discrepancy_resolution_once(uuid, uuid, uuid, double precision, double precision, text, text, text);
DROP FUNCTION IF EXISTS public.submit_stock_request_once(uuid, uuid, double precision, double precision, text, text, jsonb, uuid);
DROP FUNCTION IF EXISTS public._idem_begin(uuid, uuid, text);
DROP TABLE IF EXISTS public.client_requests;

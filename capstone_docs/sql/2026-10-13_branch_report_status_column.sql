-- Adds a per-product "Status" (Resolved / Unresolved) to get_branch_report,
-- for the new Status column on ManagerReportsScreen's Transaction Report
-- table. Same signature as before (p_branch_id, p_period_start,
-- p_period_end) -- CREATE OR REPLACE is safe, no DROP FUNCTION needed.
--
-- Status is computed per product_code, across every daily_report_item in
-- the period: a product is "Unresolved" if it has at least one item with a
-- real discrepancy (discrepancy <> 0) whose resolution_status isn't
-- 'resolved' yet; otherwise "Resolved" (covers both "no discrepancy at all"
-- and "every discrepancy for this product was resolved").

CREATE OR REPLACE FUNCTION public.get_branch_report(
  p_branch_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_products jsonb;
  v_system_details jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager' AND p_branch_id = ANY(branch_ids)
  ) THEN
    RAISE EXCEPTION 'Not authorized for this branch';
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY product_code), '[]'::jsonb)
  INTO v_products
  FROM (
    SELECT jsonb_build_object(
      'productCode', p.product_code, 'productName', p.product_name,
      'actualInventory', COALESCE(bi.actual_inv, 0),
      'sales', COALESCE(p.sales, 0), 'returned', COALESCE(p.returned, 0),
      'loss', COALESCE(p.loss, 0), 'over', COALESCE(p.over, 0),
      'status', CASE WHEN p.has_unresolved THEN 'Unresolved' ELSE 'Resolved' END
    ) AS row_data, p.product_code
    FROM (
      SELECT
        dri.product_code,
        (array_agg(dri.product_name ORDER BY dr.created_at DESC))[1] AS product_name,
        SUM(dri.sold_quantity) AS sales,
        SUM(dri.return_quantity) AS returned,
        SUM(GREATEST(-dri.discrepancy, 0)) AS loss,
        SUM(GREATEST(dri.discrepancy, 0)) AS over,
        BOOL_OR(dri.discrepancy <> 0 AND dri.resolution_status <> 'resolved') AS has_unresolved
      FROM public.daily_report_items dri
      JOIN public.daily_reports dr ON dr.id = dri.report_id
      WHERE dr.branch_id = p_branch_id AND dr.status = 'accepted'
        AND dr.report_date BETWEEN p_period_start AND p_period_end
      GROUP BY dri.product_code
    ) p
    LEFT JOIN (
      SELECT product_code, SUM(quantity) AS actual_inv
      FROM public.branch_inventory WHERE branch_id = p_branch_id
      GROUP BY product_code
    ) bi ON bi.product_code = p.product_code
  ) sub;

  SELECT jsonb_build_object(
    'reportsAccepted', (
      SELECT COUNT(*) FROM public.daily_reports
      WHERE branch_id = p_branch_id AND status = 'accepted' AND report_date BETWEEN p_period_start AND p_period_end
    ),
    'reportsAutoFiled', (
      SELECT COUNT(*) FROM public.daily_reports
      WHERE branch_id = p_branch_id AND is_auto_filed AND report_date BETWEEN p_period_start AND p_period_end
    ),
    'discrepancyResolutionsAccepted', (
      SELECT COUNT(*) FROM public.discrepancy_resolutions dres
      JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
      JOIN public.daily_reports dr ON dr.id = dri.report_id
      WHERE dr.branch_id = p_branch_id AND dres.status = 'accepted'
        AND dr.report_date BETWEEN p_period_start AND p_period_end
    ),
    'photoVerifiedResolutions', (
      SELECT COUNT(*) FROM public.discrepancy_resolutions dres
      JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
      JOIN public.daily_reports dr ON dr.id = dri.report_id
      WHERE dr.branch_id = p_branch_id AND dres.media_id IS NOT NULL
        AND dr.report_date BETWEEN p_period_start AND p_period_end
    ),
    'geotaggedResolutions', (
      SELECT COUNT(*) FROM public.discrepancy_resolutions dres
      JOIN public.daily_report_items dri ON dri.id = dres.report_item_id
      JOIN public.daily_reports dr ON dr.id = dri.report_id
      WHERE dr.branch_id = p_branch_id AND dres.gps_id IS NOT NULL
        AND dr.report_date BETWEEN p_period_start AND p_period_end
    )
  ) INTO v_system_details;

  RETURN jsonb_build_object(
    'branchId', p_branch_id, 'periodStart', p_period_start, 'periodEnd', p_period_end,
    'products', v_products, 'systemDetails', v_system_details
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_branch_report(uuid, date, date) TO authenticated;

-- PostgREST schema cache reload, same gotcha noted throughout this project's
-- other migrations.
NOTIFY pgrst, 'reload schema';

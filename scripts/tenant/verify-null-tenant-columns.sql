-- Run after migration 029 (backfill) and before migration 031 (NOT NULL).
-- Every row_count must be 0. Non-zero means backfill is incomplete.

SELECT 'buildings_and_areas' AS table_name, count(*) AS null_tenant_rows
FROM buildings_and_areas WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'property_inspection_templates', count(*)
FROM property_inspection_templates WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'inspection_settings', count(*)
FROM inspection_settings WHERE organization_id IS NULL
UNION ALL
SELECT 'inspection_sessions', count(*)
FROM inspection_sessions WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'pm_templates', count(*)
FROM pm_templates WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'pm_occurrences', count(*)
FROM pm_occurrences WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'work_orders', count(*)
FROM work_orders WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'pass_on_log', count(*)
FROM pass_on_log WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'lost_items', count(*)
FROM lost_items WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'scheduled_report_schedules', count(*)
FROM scheduled_report_schedules WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'pm_schedule_assignments', count(*)
FROM pm_schedule_assignments WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'inspection_item_responses', count(*)
FROM inspection_item_responses WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'inspection_deficiencies', count(*)
FROM inspection_deficiencies WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'area_inspection_summary', count(*)
FROM area_inspection_summary WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'pass_on_log_replies', count(*)
FROM pass_on_log_replies WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'pass_on_log_views', count(*)
FROM pass_on_log_views WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'scheduled_report_runs', count(*)
FROM scheduled_report_runs WHERE organization_id IS NULL OR property_id IS NULL
UNION ALL
SELECT 'team_members', count(*)
FROM team_members WHERE organization_id IS NULL
ORDER BY table_name;

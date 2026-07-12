/** Organization-scoped operational tables checked before test-organization deletion. */
export const ORGANIZATION_OPERATIONAL_TABLES = [
  "properties",
  "organization_users",
  "organization_invitations",
  "team_members",
  "buildings_and_areas",
  "property_inspection_templates",
  "inspection_settings",
  "inspection_sessions",
  "pm_templates",
  "pm_occurrences",
  "work_orders",
  "pass_on_log",
  "lost_items",
  "scheduled_report_schedules",
  "pm_schedule_assignments",
  "inspection_item_responses",
  "inspection_deficiencies",
  "area_inspection_summary",
  "pass_on_log_replies",
  "pass_on_log_views",
  "scheduled_report_runs",
] as const;

export const PILOT_ORGANIZATION_ID = 1;

export const ORGANIZATION_STATUS_ACTIVE = "active";
export const ORGANIZATION_STATUS_SUSPENDED = "suspended";

-- Rollback script for tenant migrations 026–033 (Checkpoint 2 apply)
-- Run ONLY if Checkpoint 2 migrations were applied and must be reversed.
-- Execute in reverse migration order: 033 → 032 → … → 026
-- WARNING: Drops tenant columns and membership data. Row data in operational
-- tables is preserved; organization_id/property_id values are discarded.

BEGIN;

-- ── 033: hotel_property_compat view ──
DROP VIEW IF EXISTS hotel_property_compat;

-- ── 032: tenant stamp triggers ──
DROP TRIGGER IF EXISTS trg_scheduled_report_runs_stamp_tenant ON scheduled_report_runs;
DROP TRIGGER IF EXISTS trg_pass_on_log_views_stamp_tenant ON pass_on_log_views;
DROP TRIGGER IF EXISTS trg_pass_on_log_replies_stamp_tenant ON pass_on_log_replies;
DROP TRIGGER IF EXISTS trg_area_inspection_summary_stamp_tenant ON area_inspection_summary;
DROP TRIGGER IF EXISTS trg_inspection_deficiencies_stamp_tenant ON inspection_deficiencies;
DROP TRIGGER IF EXISTS trg_inspection_item_responses_stamp_tenant ON inspection_item_responses;
DROP TRIGGER IF EXISTS trg_pm_schedule_assignments_stamp_tenant ON pm_schedule_assignments;

DROP FUNCTION IF EXISTS public.stamp_tenant_from_scheduled_report_schedule();
DROP FUNCTION IF EXISTS public.stamp_tenant_from_pass_on_log();
DROP FUNCTION IF EXISTS public.stamp_tenant_from_building_area();
DROP FUNCTION IF EXISTS public.stamp_tenant_from_inspection_session();
DROP FUNCTION IF EXISTS public.stamp_tenant_from_pm_template();

-- ── 031: NOT NULL constraints (make nullable again) ──
ALTER TABLE team_members ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE scheduled_report_runs
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE pass_on_log_views
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE pass_on_log_replies
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE area_inspection_summary
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE inspection_deficiencies
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE inspection_item_responses
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE pm_schedule_assignments
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE scheduled_report_schedules
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE lost_items
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE pass_on_log
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE work_orders
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE pm_occurrences
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE pm_templates
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE inspection_sessions
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE inspection_settings ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE property_inspection_templates
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE buildings_and_areas
  ALTER COLUMN organization_id DROP NOT NULL,
  ALTER COLUMN property_id DROP NOT NULL;

-- ── 030: team_members columns + FK/index changes ──
DROP INDEX IF EXISTS buildings_and_areas_property_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS buildings_and_areas_name_unique
  ON buildings_and_areas (name);

ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_property_id_fkey;
ALTER TABLE team_members
  ADD CONSTRAINT team_members_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES hotel_property(id) ON DELETE RESTRICT;

ALTER TABLE scheduled_report_schedules DROP CONSTRAINT IF EXISTS scheduled_report_schedules_property_id_fkey;
ALTER TABLE scheduled_report_schedules
  ADD CONSTRAINT scheduled_report_schedules_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES hotel_property(id) ON DELETE RESTRICT;

ALTER TABLE team_members
  DROP COLUMN IF EXISTS default_property_id,
  DROP COLUMN IF EXISTS organization_id;

-- ── 029: backfill (no structural rollback; optional null-out below if needed) ──
-- Uncomment to clear tenant stamps before dropping columns in 028:
-- UPDATE buildings_and_areas SET organization_id = NULL, property_id = NULL;
-- (repeat for each table that received 029 updates)

-- ── 028: drop tenant columns ──
ALTER TABLE scheduled_report_runs
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE pass_on_log_views
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE pass_on_log_replies
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE area_inspection_summary
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE inspection_deficiencies
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE inspection_item_responses
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE pm_schedule_assignments
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE scheduled_report_schedules
  DROP COLUMN IF EXISTS organization_id;

ALTER TABLE lost_items
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE pass_on_log
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE work_orders
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE pm_occurrences
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE pm_templates
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE inspection_sessions
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE inspection_settings DROP COLUMN IF EXISTS organization_id;

ALTER TABLE property_inspection_templates
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

ALTER TABLE buildings_and_areas
  DROP COLUMN IF EXISTS organization_id,
  DROP COLUMN IF EXISTS property_id;

-- ── 027: membership tables ──
DROP TABLE IF EXISTS user_properties;
DROP TABLE IF EXISTS organization_users;

-- ── 026: tenant root tables ──
DROP TABLE IF EXISTS properties;
DROP TABLE IF EXISTS organizations;

COMMIT;

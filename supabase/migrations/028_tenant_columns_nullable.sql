-- Migration 028: Add nullable organization_id + property_id to tenant-owned tables
-- Applied to Supabase (Checkpoint 2).

BEGIN;

-- Root operational tables
ALTER TABLE buildings_and_areas
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE property_inspection_templates
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE inspection_settings
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id);

ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE pm_templates
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE pm_occurrences
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE pass_on_log
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE lost_items
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE scheduled_report_schedules
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id);

-- Child / denormalized tables
ALTER TABLE pm_schedule_assignments
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE inspection_item_responses
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE inspection_deficiencies
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE area_inspection_summary
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE pass_on_log_replies
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE pass_on_log_views
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

ALTER TABLE scheduled_report_runs
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

COMMIT;

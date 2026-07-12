-- Migration 030: team_members org columns + buildings_and_areas per-property uniqueness
-- Applied to Supabase (Checkpoint 2).

BEGIN;

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS default_property_id INT REFERENCES properties(id);

UPDATE team_members
SET organization_id = 1,
    default_property_id = coalesce(property_id, 1)
WHERE organization_id IS NULL OR default_property_id IS NULL;

-- Repoint scheduled_report_schedules.property_id FK from hotel_property → properties
ALTER TABLE scheduled_report_schedules
  DROP CONSTRAINT IF EXISTS scheduled_report_schedules_property_id_fkey;

ALTER TABLE scheduled_report_schedules
  ADD CONSTRAINT scheduled_report_schedules_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT;

-- Repoint team_members.property_id FK from hotel_property → properties (compat until Checkpoint 8)
ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_property_id_fkey;

ALTER TABLE team_members
  ADD CONSTRAINT team_members_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT;

-- Replace global unique name with per-property unique name
ALTER TABLE buildings_and_areas
  DROP CONSTRAINT IF EXISTS buildings_and_areas_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS buildings_and_areas_property_name_unique
  ON buildings_and_areas (property_id, name);

COMMIT;

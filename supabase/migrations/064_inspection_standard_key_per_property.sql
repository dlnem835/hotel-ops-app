-- Migration 064: Scope inspection standard_key uniqueness per property
-- Matches Standard PM uniqueness (061) so every hotel can Activate the same
-- Room / RPM masters from the One Eyrie Standard Library.

BEGIN;

DROP INDEX IF EXISTS property_inspection_templates_standard_key_unique;

CREATE UNIQUE INDEX IF NOT EXISTS property_inspection_templates_property_standard_key_unique
  ON property_inspection_templates (organization_id, property_id, standard_key)
  WHERE standard_key IS NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Identifies One Eyrie starter templates after they are copied into a property.
-- The copied PM remains fully property-owned and editable.

ALTER TABLE pm_templates
  ADD COLUMN IF NOT EXISTS standard_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS pm_templates_property_standard_key_unique
  ON pm_templates (organization_id, property_id, standard_key)
  WHERE standard_key IS NOT NULL;

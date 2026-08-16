-- Allows a location-based PM to own editable named targets (for example floors)
-- without requiring each target to be a pre-existing Rooms & Areas record.

ALTER TABLE pm_templates
  ADD COLUMN IF NOT EXISTS named_locations BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';

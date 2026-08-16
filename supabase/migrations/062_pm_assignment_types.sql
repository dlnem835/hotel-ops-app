-- Distinguishes location-based PM programs from equipment/unit programs.
-- Existing PMs remain location-based and existing assignment/history rows are unchanged.

ALTER TABLE pm_templates
  ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'area_location';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pm_templates_assignment_type_check'
  ) THEN
    ALTER TABLE pm_templates
      ADD CONSTRAINT pm_templates_assignment_type_check
      CHECK (assignment_type IN ('area_location', 'equipment_unit'));
  END IF;
END $$;

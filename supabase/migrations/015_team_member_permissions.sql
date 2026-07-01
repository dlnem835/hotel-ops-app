-- Team member permissions: job title (informational) + module checkboxes

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS is_administrator BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS module_permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE team_members
SET job_title = role
WHERE job_title IS NULL AND role IS NOT NULL;

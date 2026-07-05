-- PM occurrence audit metadata
-- created_at, completed_at, and completed_by already exist from 009_maintenance_work_orders.sql.
-- This migration adds created_by for accountability when a PM session is opened.

ALTER TABLE pm_occurrences
  ADD COLUMN IF NOT EXISTS created_by TEXT;

COMMENT ON COLUMN pm_occurrences.created_at IS 'When this PM occurrence record was created.';
COMMENT ON COLUMN pm_occurrences.created_by IS 'Team member username or name who opened this PM occurrence.';
COMMENT ON COLUMN pm_occurrences.completed_at IS 'When this PM occurrence was marked completed.';
COMMENT ON COLUMN pm_occurrences.completed_by IS 'Team member username or name who completed this PM occurrence.';

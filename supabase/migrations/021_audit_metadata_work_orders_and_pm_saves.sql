-- Work order completion accountability
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS completed_by TEXT;

-- PM save-progress accountability (created_by = who opened; last_saved_* = latest save)
ALTER TABLE pm_occurrences
  ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMPTZ;

ALTER TABLE pm_occurrences
  ADD COLUMN IF NOT EXISTS last_saved_by TEXT;

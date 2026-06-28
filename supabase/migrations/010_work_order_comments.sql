-- Work order technician comments (separate from original description)

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS comments TEXT;

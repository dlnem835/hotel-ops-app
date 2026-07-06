-- Track when work order comments were last saved (Pass-On Log edited_at pattern).
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS comments_updated_at TIMESTAMPTZ;

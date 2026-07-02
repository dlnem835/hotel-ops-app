ALTER TABLE pass_on_log_replies
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

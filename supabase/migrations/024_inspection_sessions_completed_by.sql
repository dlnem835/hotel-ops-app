ALTER TABLE inspection_sessions
  ADD COLUMN IF NOT EXISTS completed_by TEXT;

COMMENT ON COLUMN inspection_sessions.completed_by IS
  'Team member display name who completed the inspection session.';

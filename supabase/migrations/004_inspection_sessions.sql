-- Inspection sessions, responses, deficiencies
-- Run after 003_property_inspection_templates.sql
--
-- FK type alignment with existing One Eyrie tables:
--   buildings_and_areas.id            → BIGINT      (migration 001)
--   property_inspection_templates.id  → BIGINT      (migration 003)
--   team_members.id                   → UUID        (existing app table)
--
-- If a previous 004 attempt failed partway, run cleanup first:
--   DROP TABLE IF EXISTS inspection_deficiencies CASCADE;
--   DROP TABLE IF EXISTS inspection_item_responses CASCADE;
--   DROP TABLE IF EXISTS inspection_sessions CASCADE;

CREATE TABLE IF NOT EXISTS inspection_sessions (
  id BIGSERIAL PRIMARY KEY,
  area_id BIGINT NOT NULL REFERENCES buildings_and_areas(id) ON DELETE RESTRICT,
  template_id BIGINT NOT NULL REFERENCES property_inspection_templates(id) ON DELETE RESTRICT,
  inspection_program TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  inspector_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  associate_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  earned_points INT NOT NULL DEFAULT 0,
  possible_points INT NOT NULL DEFAULT 0,
  score_percent NUMERIC(5, 2),
  failed_item_count INT NOT NULL DEFAULT 0,
  session_notes TEXT,
  template_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inspection_sessions_status_check CHECK (
    status IN ('draft', 'in_progress', 'completed', 'voided')
  ),
  CONSTRAINT inspection_sessions_program_check CHECK (
    inspection_program IN (
      'VR', 'STAYOVER', 'DEEP_CLEAN', 'RPM',
      'PUBLIC_AREA', 'EXTERIOR', 'POOL', 'SAFETY', 'CUSTOM'
    )
  )
);

CREATE TABLE IF NOT EXISTS inspection_item_responses (
  id BIGSERIAL PRIMARY KEY,
  inspection_id BIGINT NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  item_key TEXT NOT NULL,
  label_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  point_value INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  outcome TEXT NOT NULL,
  points_earned INT NOT NULL DEFAULT 0,
  item_notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT inspection_item_responses_outcome_check CHECK (
    outcome IN ('pass', 'fail', 'na')
  ),
  CONSTRAINT inspection_item_responses_unique UNIQUE (
    inspection_id, category_key, item_key
  )
);

CREATE TABLE IF NOT EXISTS inspection_deficiencies (
  id BIGSERIAL PRIMARY KEY,
  inspection_id BIGINT NOT NULL REFERENCES inspection_sessions(id) ON DELETE CASCADE,
  item_response_id BIGINT REFERENCES inspection_item_responses(id) ON DELETE SET NULL,
  area_id BIGINT NOT NULL REFERENCES buildings_and_areas(id) ON DELETE CASCADE,
  inspection_program TEXT NOT NULL,
  category_key TEXT NOT NULL,
  item_key TEXT NOT NULL,
  item_label_snapshot TEXT NOT NULL DEFAULT '',
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  recurrence_group_key TEXT NOT NULL,
  occurrence_count INT NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inspection_deficiencies_severity_check CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT inspection_deficiencies_status_check CHECK (
    status IN ('open', 'resolved', 'waived')
  )
);

CREATE INDEX IF NOT EXISTS inspection_sessions_area_program_completed_idx
  ON inspection_sessions (area_id, inspection_program, completed_at DESC)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS inspection_sessions_completed_at_idx
  ON inspection_sessions (completed_at DESC)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS inspection_sessions_status_idx
  ON inspection_sessions (status);

CREATE INDEX IF NOT EXISTS inspection_sessions_inspector_id_idx
  ON inspection_sessions (inspector_id);

CREATE INDEX IF NOT EXISTS inspection_item_responses_inspection_id_idx
  ON inspection_item_responses (inspection_id);

CREATE INDEX IF NOT EXISTS inspection_deficiencies_area_status_idx
  ON inspection_deficiencies (area_id, status);

CREATE INDEX IF NOT EXISTS inspection_deficiencies_recurrence_idx
  ON inspection_deficiencies (recurrence_group_key);

ALTER TABLE inspection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_item_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_deficiencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inspection_sessions"
  ON inspection_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert inspection_sessions"
  ON inspection_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update inspection_sessions"
  ON inspection_sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read inspection_item_responses"
  ON inspection_item_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert inspection_item_responses"
  ON inspection_item_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update inspection_item_responses"
  ON inspection_item_responses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read inspection_deficiencies"
  ON inspection_deficiencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert inspection_deficiencies"
  ON inspection_deficiencies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update inspection_deficiencies"
  ON inspection_deficiencies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

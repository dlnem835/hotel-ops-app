-- Inspection summary read model + property settings
-- Run after 004_inspection_sessions.sql
--
-- FK type alignment:
--   buildings_and_areas.id       → BIGINT
--   inspection_sessions.id       → BIGINT
--   team_members.id              → UUID

CREATE TABLE IF NOT EXISTS area_inspection_summary (
  area_id BIGINT NOT NULL REFERENCES buildings_and_areas(id) ON DELETE CASCADE,
  inspection_program TEXT NOT NULL,
  last_completed_at TIMESTAMPTZ,
  last_inspection_id BIGINT REFERENCES inspection_sessions(id) ON DELETE SET NULL,
  last_score_percent NUMERIC(5, 2),
  last_inspector_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  last_failed_item_count INT NOT NULL DEFAULT 0,
  open_deficiency_count INT NOT NULL DEFAULT 0,
  recurring_deficiency_count INT NOT NULL DEFAULT 0,
  never_inspected BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (area_id, inspection_program),
  CONSTRAINT area_inspection_summary_program_check CHECK (
    inspection_program IN (
      'VR', 'STAYOVER', 'DEEP_CLEAN', 'RPM',
      'PUBLIC_AREA', 'EXTERIOR', 'POOL', 'SAFETY', 'CUSTOM'
    )
  )
);

CREATE INDEX IF NOT EXISTS area_inspection_summary_program_last_idx
  ON area_inspection_summary (inspection_program, last_completed_at ASC NULLS FIRST);

CREATE TABLE IF NOT EXISTS inspection_settings (
  id INT PRIMARY KEY DEFAULT 1,
  property_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  week_starts_on TEXT NOT NULL DEFAULT 'monday',
  low_score_threshold NUMERIC(5, 2) NOT NULL DEFAULT 80,
  strong_score_threshold NUMERIC(5, 2) NOT NULL DEFAULT 90,
  priority_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inspection_settings_singleton CHECK (id = 1),
  CONSTRAINT inspection_settings_week_check CHECK (
    week_starts_on IN ('monday', 'sunday')
  )
);

INSERT INTO inspection_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE area_inspection_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read area_inspection_summary"
  ON area_inspection_summary FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert area_inspection_summary"
  ON area_inspection_summary FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update area_inspection_summary"
  ON area_inspection_summary FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read inspection_settings"
  ON inspection_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update inspection_settings"
  ON inspection_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

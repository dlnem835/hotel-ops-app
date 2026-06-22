-- PM Scheduler templates and schedule assignments
-- Run after 001_buildings_and_areas.sql

CREATE TABLE IF NOT EXISTS pm_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL,
  estimated_minutes INT,
  assigned_role TEXT,
  assigned_member_id UUID,
  applies_to TEXT NOT NULL,
  checklist JSONB NOT NULL DEFAULT '{"categories":[]}'::jsonb,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pm_templates_status_check CHECK (status IN ('Active', 'Inactive')),
  CONSTRAINT pm_templates_category_check CHECK (
    category IN (
      'Building',
      'Mechanical',
      'Life Safety',
      'Pool',
      'Guest Room',
      'Public Area',
      'Exterior',
      'Equipment',
      'Custom'
    )
  ),
  CONSTRAINT pm_templates_frequency_check CHECK (
    frequency IN (
      'daily',
      'weekly',
      'biweekly',
      'monthly',
      'quarterly',
      'triannually',
      'semiannually',
      'yearly'
    )
  ),
  CONSTRAINT pm_templates_applies_to_check CHECK (
    applies_to IN (
      'entire_property',
      'asset',
      'room',
      'public_area',
      'exterior_area'
    )
  )
);

CREATE TABLE IF NOT EXISTS pm_schedule_assignments (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES pm_templates(id) ON DELETE CASCADE,
  area_id BIGINT REFERENCES buildings_and_areas(id) ON DELETE SET NULL,
  asset_label TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pm_schedule_assignments_status_check CHECK (status IN ('Active', 'Inactive'))
);

CREATE INDEX IF NOT EXISTS pm_templates_frequency_idx ON pm_templates (frequency);
CREATE INDEX IF NOT EXISTS pm_templates_status_idx ON pm_templates (status);
CREATE INDEX IF NOT EXISTS pm_schedule_assignments_template_idx
  ON pm_schedule_assignments (template_id);
CREATE INDEX IF NOT EXISTS pm_schedule_assignments_area_idx
  ON pm_schedule_assignments (area_id);

ALTER TABLE pm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_schedule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pm_templates"
  ON pm_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pm_templates"
  ON pm_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pm_templates"
  ON pm_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete pm_templates"
  ON pm_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read pm_schedule_assignments"
  ON pm_schedule_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pm_schedule_assignments"
  ON pm_schedule_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pm_schedule_assignments"
  ON pm_schedule_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete pm_schedule_assignments"
  ON pm_schedule_assignments FOR DELETE TO authenticated USING (true);

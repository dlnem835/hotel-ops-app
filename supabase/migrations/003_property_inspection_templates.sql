-- Property-specific inspection template copies (JSON snapshot model)
-- Masters live in app code; Supabase stores hotel copies only.
-- Run in Supabase SQL Editor after 002_inspection_templates.sql

CREATE TABLE IF NOT EXISTS property_inspection_templates (
  id BIGSERIAL PRIMARY KEY,
  standard_key TEXT,
  based_on_standard_version TEXT,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  property_version INT NOT NULL DEFAULT 1,
  content JSONB NOT NULL,
  last_modified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT property_inspection_templates_status_check CHECK (
    status IN ('Active', 'Inactive')
  ),
  CONSTRAINT property_inspection_templates_type_check CHECK (
    template_type IN ('Guest Room', 'Public Area', 'RPM', 'Safety', 'Custom')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS property_inspection_templates_standard_key_unique
  ON property_inspection_templates (standard_key)
  WHERE standard_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_inspection_templates_status_idx
  ON property_inspection_templates (status);

ALTER TABLE property_inspection_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read property_inspection_templates"
  ON property_inspection_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert property_inspection_templates"
  ON property_inspection_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update property_inspection_templates"
  ON property_inspection_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete property_inspection_templates"
  ON property_inspection_templates FOR DELETE TO authenticated USING (true);

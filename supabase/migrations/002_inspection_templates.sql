-- Inspection Templates with categories and checklist items
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS inspection_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT inspection_templates_status_check CHECK (
    status IN ('Active', 'Inactive')
  ),
  CONSTRAINT inspection_templates_type_check CHECK (
    template_type IN ('Guest Room', 'Public Area', 'RPM', 'Safety', 'Custom')
  )
);

CREATE TABLE IF NOT EXISTS inspection_template_categories (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES inspection_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inspection_template_items (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES inspection_template_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  point_value INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inspection_template_categories_template_id_idx
  ON inspection_template_categories (template_id);

CREATE INDEX IF NOT EXISTS inspection_template_items_category_id_idx
  ON inspection_template_items (category_id);

ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inspection_templates"
  ON inspection_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert inspection_templates"
  ON inspection_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update inspection_templates"
  ON inspection_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete inspection_templates"
  ON inspection_templates FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read inspection_template_categories"
  ON inspection_template_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert inspection_template_categories"
  ON inspection_template_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update inspection_template_categories"
  ON inspection_template_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete inspection_template_categories"
  ON inspection_template_categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read inspection_template_items"
  ON inspection_template_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert inspection_template_items"
  ON inspection_template_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update inspection_template_items"
  ON inspection_template_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete inspection_template_items"
  ON inspection_template_items FOR DELETE TO authenticated USING (true);

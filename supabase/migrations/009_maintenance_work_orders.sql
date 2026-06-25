-- Maintenance work orders and PM occurrence tracking
-- Run after 007_pm_templates.sql and 008_pm_bimonthly_frequency.sql

CREATE TABLE IF NOT EXISTS work_orders (
  id BIGSERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'Normal',
  status TEXT NOT NULL DEFAULT 'Open',
  area_id BIGINT REFERENCES buildings_and_areas(id) ON DELETE SET NULL,
  area_label TEXT,
  source_module TEXT,
  source_record_id TEXT,
  source_note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT work_orders_priority_check CHECK (
    priority IN ('Normal', 'Important', 'Urgent')
  ),
  CONSTRAINT work_orders_status_check CHECK (
    status IN ('Open', 'In Progress', 'Completed', 'Cancelled')
  )
);

CREATE TABLE IF NOT EXISTS pm_occurrences (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES pm_templates(id) ON DELETE CASCADE,
  assignment_id BIGINT NOT NULL REFERENCES pm_schedule_assignments(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  responses JSONB NOT NULL DEFAULT '{"steps":[]}'::jsonb,
  session_notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pm_occurrences_status_check CHECK (status IN ('open', 'completed'))
);

CREATE INDEX IF NOT EXISTS work_orders_status_idx ON work_orders (status);
CREATE INDEX IF NOT EXISTS work_orders_priority_idx ON work_orders (priority);
CREATE INDEX IF NOT EXISTS work_orders_created_at_idx ON work_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS pm_occurrences_assignment_due_idx
  ON pm_occurrences (assignment_id, due_date);
CREATE INDEX IF NOT EXISTS pm_occurrences_status_idx ON pm_occurrences (status);
CREATE INDEX IF NOT EXISTS pm_occurrences_completed_at_idx
  ON pm_occurrences (completed_at);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read work_orders"
  ON work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert work_orders"
  ON work_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update work_orders"
  ON work_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete work_orders"
  ON work_orders FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read pm_occurrences"
  ON pm_occurrences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pm_occurrences"
  ON pm_occurrences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pm_occurrences"
  ON pm_occurrences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete pm_occurrences"
  ON pm_occurrences FOR DELETE TO authenticated USING (true);

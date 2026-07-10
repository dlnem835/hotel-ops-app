-- Scheduled report email delivery
-- Run after 011_hotel_property_info.sql

CREATE TABLE IF NOT EXISTS scheduled_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id INT NOT NULL DEFAULT 1 REFERENCES hotel_property(id),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  report_module TEXT NOT NULL,
  report_id TEXT NOT NULL,
  report_name TEXT NOT NULL,
  property_name TEXT NOT NULL DEFAULT '',
  date_range_label TEXT NOT NULL DEFAULT '',
  date_preset TEXT NOT NULL DEFAULT 'mtd',
  date_start TEXT NOT NULL DEFAULT '',
  date_end TEXT NOT NULL DEFAULT '',
  filter_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  filter_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  inspection_variant TEXT,
  recipients TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL,
  repeat_every INT NOT NULL DEFAULT 1,
  interval_unit TEXT NOT NULL,
  weekly_day TEXT,
  monthly_day INT,
  schedule_time TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  start_date TEXT NOT NULL,
  end_date TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  processing_claimed_at TIMESTAMPTZ,
  processing_claim_token UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES scheduled_report_schedules(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  resend_message_id TEXT,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_report_schedules_due_idx
  ON scheduled_report_schedules (next_run_at)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS scheduled_report_runs_schedule_id_idx
  ON scheduled_report_runs (schedule_id, ran_at DESC);

ALTER TABLE scheduled_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read scheduled_report_schedules"
  ON scheduled_report_schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert scheduled_report_schedules"
  ON scheduled_report_schedules FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update scheduled_report_schedules"
  ON scheduled_report_schedules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete scheduled_report_schedules"
  ON scheduled_report_schedules FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read scheduled_report_runs"
  ON scheduled_report_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert scheduled_report_runs"
  ON scheduled_report_runs FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION claim_scheduled_report_schedule(
  p_schedule_id UUID,
  p_claim_token UUID,
  p_now TIMESTAMPTZ,
  p_stale_before TIMESTAMPTZ
)
RETURNS SETOF scheduled_report_schedules
LANGUAGE sql
AS $$
  UPDATE scheduled_report_schedules
  SET
    processing_claimed_at = p_now,
    processing_claim_token = p_claim_token,
    updated_at = p_now
  WHERE id = p_schedule_id
    AND active = true
    AND next_run_at <= p_now
    AND (processing_claimed_at IS NULL OR processing_claimed_at < p_stale_before)
  RETURNING *;
$$;

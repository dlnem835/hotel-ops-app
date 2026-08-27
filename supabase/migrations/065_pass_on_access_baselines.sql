-- Migration 065: Pass-On first-access baselines for users without user_properties
--
-- user_properties.pass_on_read_baseline (044) already stamps new property
-- memberships. Org-wide roles can access a property without a user_properties
-- row; this table records their first Pass-On/Dashboard access as the baseline
-- for that property only.
--
-- Existing user_properties rows with NULL baseline stay legacy (no cutoff).
-- Existing users who already viewed Pass-On at a property are not stamped here
-- by application logic.

BEGIN;

CREATE TABLE IF NOT EXISTS pass_on_access_baselines (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
  baseline_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS pass_on_access_baselines_property_idx
  ON pass_on_access_baselines (property_id);

COMMENT ON TABLE pass_on_access_baselines IS
  'Per-user/per-property Pass-On KPI baseline for first access when no user_properties.pass_on_read_baseline exists. Never rewrite existing rows.';

ALTER TABLE pass_on_access_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pass_on_access_baselines_select_own ON pass_on_access_baselines;
CREATE POLICY pass_on_access_baselines_select_own
  ON pass_on_access_baselines FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pass_on_access_baselines_insert_own ON pass_on_access_baselines;
CREATE POLICY pass_on_access_baselines_insert_own
  ON pass_on_access_baselines FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMIT;

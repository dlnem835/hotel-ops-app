-- CHECKPOINT 2 — REVIEW ONLY. DO NOT APPLY until approved after Checkpoint 1 review.
-- Migration 031: Enforce NOT NULL tenant columns after backfill verification
-- Run scripts/tenant/verify-row-counts.mjs --all before and after this migration.

BEGIN;

-- Verify no null tenant columns remain (raises error if backfill incomplete)
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT count(*) INTO v_count FROM buildings_and_areas WHERE organization_id IS NULL OR property_id IS NULL;
  IF v_count > 0 THEN RAISE EXCEPTION 'buildings_and_areas has % rows with null tenant columns', v_count; END IF;

  SELECT count(*) INTO v_count FROM work_orders WHERE organization_id IS NULL OR property_id IS NULL;
  IF v_count > 0 THEN RAISE EXCEPTION 'work_orders has % rows with null tenant columns', v_count; END IF;

  SELECT count(*) INTO v_count FROM pass_on_log WHERE organization_id IS NULL OR property_id IS NULL;
  IF v_count > 0 THEN RAISE EXCEPTION 'pass_on_log has % rows with null tenant columns', v_count; END IF;

  SELECT count(*) INTO v_count FROM lost_items WHERE organization_id IS NULL OR property_id IS NULL;
  IF v_count > 0 THEN RAISE EXCEPTION 'lost_items has % rows with null tenant columns', v_count; END IF;
END $$;

ALTER TABLE buildings_and_areas
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE property_inspection_templates
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE inspection_settings
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE inspection_sessions
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE pm_templates
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE pm_occurrences
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE work_orders
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE pass_on_log
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE lost_items
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE scheduled_report_schedules
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE pm_schedule_assignments
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE inspection_item_responses
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE inspection_deficiencies
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE area_inspection_summary
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE pass_on_log_replies
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE pass_on_log_views
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE scheduled_report_runs
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE team_members
  ALTER COLUMN organization_id SET NOT NULL;

COMMIT;

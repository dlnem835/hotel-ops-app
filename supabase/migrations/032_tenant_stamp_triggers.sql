-- Migration 032: Tenant stamp triggers for child tables on INSERT/UPDATE
-- Applied to Supabase (Checkpoint 2). Post-apply smoke: scripts/tenant/smoke-post-031-032.mjs

BEGIN;

CREATE OR REPLACE FUNCTION public.stamp_tenant_from_pm_template()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT organization_id, property_id
  INTO NEW.organization_id, NEW.property_id
  FROM pm_templates
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pm_schedule_assignments_stamp_tenant ON pm_schedule_assignments;
CREATE TRIGGER trg_pm_schedule_assignments_stamp_tenant
  BEFORE INSERT OR UPDATE OF template_id ON pm_schedule_assignments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_pm_template();

CREATE OR REPLACE FUNCTION public.stamp_tenant_from_inspection_session()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT organization_id, property_id
  INTO NEW.organization_id, NEW.property_id
  FROM inspection_sessions
  WHERE id = NEW.inspection_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_item_responses_stamp_tenant ON inspection_item_responses;
CREATE TRIGGER trg_inspection_item_responses_stamp_tenant
  BEFORE INSERT OR UPDATE OF inspection_id ON inspection_item_responses
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_inspection_session();

DROP TRIGGER IF EXISTS trg_inspection_deficiencies_stamp_tenant ON inspection_deficiencies;
CREATE TRIGGER trg_inspection_deficiencies_stamp_tenant
  BEFORE INSERT OR UPDATE OF inspection_id ON inspection_deficiencies
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_inspection_session();

CREATE OR REPLACE FUNCTION public.stamp_tenant_from_building_area()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT organization_id, property_id
  INTO NEW.organization_id, NEW.property_id
  FROM buildings_and_areas
  WHERE id = NEW.area_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_area_inspection_summary_stamp_tenant ON area_inspection_summary;
CREATE TRIGGER trg_area_inspection_summary_stamp_tenant
  BEFORE INSERT OR UPDATE OF area_id ON area_inspection_summary
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_building_area();

CREATE OR REPLACE FUNCTION public.stamp_tenant_from_pass_on_log()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT organization_id, property_id
  INTO NEW.organization_id, NEW.property_id
  FROM pass_on_log
  WHERE id = NEW.entry_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pass_on_log_replies_stamp_tenant ON pass_on_log_replies;
CREATE TRIGGER trg_pass_on_log_replies_stamp_tenant
  BEFORE INSERT OR UPDATE OF entry_id ON pass_on_log_replies
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_pass_on_log();

DROP TRIGGER IF EXISTS trg_pass_on_log_views_stamp_tenant ON pass_on_log_views;
CREATE TRIGGER trg_pass_on_log_views_stamp_tenant
  BEFORE INSERT OR UPDATE OF entry_id ON pass_on_log_views
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_pass_on_log();

CREATE OR REPLACE FUNCTION public.stamp_tenant_from_scheduled_report_schedule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT organization_id, property_id
  INTO NEW.organization_id, NEW.property_id
  FROM scheduled_report_schedules
  WHERE id = NEW.schedule_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scheduled_report_runs_stamp_tenant ON scheduled_report_runs;
CREATE TRIGGER trg_scheduled_report_runs_stamp_tenant
  BEFORE INSERT OR UPDATE OF schedule_id ON scheduled_report_runs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_tenant_from_scheduled_report_schedule();

COMMIT;

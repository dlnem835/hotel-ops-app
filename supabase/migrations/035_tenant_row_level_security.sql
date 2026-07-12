-- Migration 035: Tenant Row Level Security (Checkpoint 5)
-- Replace permissive authenticated policies with organization/property membership checks.
-- Apply after migrations 026–034. Requires user_properties + organization_users backfill.

BEGIN;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers (membership-backed; no RLS recursion)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_has_organization_access(p_organization_id INT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_users ou
    WHERE ou.user_id = auth.uid()
      AND ou.organization_id = p_organization_id
      AND ou.active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_has_property_access(p_property_id INT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_properties up
    WHERE up.user_id = auth.uid()
      AND up.property_id = p_property_id
      AND up.active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_can_access_tenant_row(
  p_organization_id INT,
  p_property_id INT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_user_has_organization_access(p_organization_id)
     AND public.auth_user_has_property_access(p_property_id);
$$;

REVOKE ALL ON FUNCTION public.auth_user_has_organization_access(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_has_property_access(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_user_can_access_tenant_row(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_has_organization_access(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_has_property_access(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_can_access_tenant_row(INT, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Drop legacy permissive policies (dynamic per table)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'buildings_and_areas',
    'property_inspection_templates',
    'inspection_sessions',
    'inspection_item_responses',
    'inspection_deficiencies',
    'area_inspection_summary',
    'inspection_settings',
    'pm_templates',
    'pm_schedule_assignments',
    'pm_occurrences',
    'work_orders',
    'pass_on_log',
    'pass_on_log_replies',
    'pass_on_log_views',
    'lost_items',
    'scheduled_report_schedules',
    'scheduled_report_runs',
    'team_members',
    'organizations',
    'properties',
    'organization_users',
    'user_properties'
  ];
  t TEXT;
  r RECORD;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Membership root tables
-- ---------------------------------------------------------------------------

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_organizations_select
  ON organizations FOR SELECT TO authenticated
  USING (public.auth_user_has_organization_access(id));

CREATE POLICY tenant_properties_select
  ON properties FOR SELECT TO authenticated
  USING (public.auth_user_has_property_access(id));

CREATE POLICY tenant_organization_users_select
  ON organization_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY tenant_user_properties_select
  ON user_properties FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Standard tenant-owned tables (organization_id + property_id)
-- ---------------------------------------------------------------------------

ALTER TABLE buildings_and_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_item_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_deficiencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_inspection_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pass_on_log_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_report_runs ENABLE ROW LEVEL SECURITY;

-- buildings_and_areas
CREATE POLICY tenant_buildings_and_areas_select ON buildings_and_areas
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_buildings_and_areas_insert ON buildings_and_areas
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_buildings_and_areas_update ON buildings_and_areas
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_buildings_and_areas_delete ON buildings_and_areas
  FOR DELETE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- property_inspection_templates
CREATE POLICY tenant_property_inspection_templates_select ON property_inspection_templates
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_property_inspection_templates_insert ON property_inspection_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_property_inspection_templates_update ON property_inspection_templates
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_property_inspection_templates_delete ON property_inspection_templates
  FOR DELETE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- inspection_sessions
CREATE POLICY tenant_inspection_sessions_select ON inspection_sessions
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_inspection_sessions_insert ON inspection_sessions
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_inspection_sessions_update ON inspection_sessions
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- inspection_item_responses
CREATE POLICY tenant_inspection_item_responses_select ON inspection_item_responses
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_inspection_item_responses_insert ON inspection_item_responses
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_inspection_item_responses_update ON inspection_item_responses
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- inspection_deficiencies
CREATE POLICY tenant_inspection_deficiencies_select ON inspection_deficiencies
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_inspection_deficiencies_insert ON inspection_deficiencies
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_inspection_deficiencies_update ON inspection_deficiencies
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- area_inspection_summary
CREATE POLICY tenant_area_inspection_summary_select ON area_inspection_summary
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_area_inspection_summary_insert ON area_inspection_summary
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_area_inspection_summary_update ON area_inspection_summary
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- inspection_settings (organization scope only)
ALTER TABLE inspection_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_inspection_settings_select ON inspection_settings
  FOR SELECT TO authenticated
  USING (public.auth_user_has_organization_access(organization_id));
CREATE POLICY tenant_inspection_settings_update ON inspection_settings
  FOR UPDATE TO authenticated
  USING (public.auth_user_has_organization_access(organization_id))
  WITH CHECK (public.auth_user_has_organization_access(organization_id));

-- pm_templates
CREATE POLICY tenant_pm_templates_select ON pm_templates
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pm_templates_insert ON pm_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pm_templates_update ON pm_templates
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pm_templates_delete ON pm_templates
  FOR DELETE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- pm_schedule_assignments
CREATE POLICY tenant_pm_schedule_assignments_select ON pm_schedule_assignments
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pm_schedule_assignments_insert ON pm_schedule_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pm_schedule_assignments_update ON pm_schedule_assignments
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pm_schedule_assignments_delete ON pm_schedule_assignments
  FOR DELETE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- pm_occurrences
CREATE POLICY tenant_pm_occurrences_select ON pm_occurrences
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pm_occurrences_insert ON pm_occurrences
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pm_occurrences_update ON pm_occurrences
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pm_occurrences_delete ON pm_occurrences
  FOR DELETE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- work_orders
CREATE POLICY tenant_work_orders_select ON work_orders
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_work_orders_insert ON work_orders
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_work_orders_update ON work_orders
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_work_orders_delete ON work_orders
  FOR DELETE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- lost_items
CREATE POLICY tenant_lost_items_select ON lost_items
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_lost_items_insert ON lost_items
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_lost_items_update ON lost_items
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_lost_items_delete ON lost_items
  FOR DELETE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- pass_on_log (author/admin rules preserved)
ALTER TABLE pass_on_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_pass_on_log_select ON pass_on_log
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pass_on_log_insert ON pass_on_log
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pass_on_log_update ON pass_on_log
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_can_access_tenant_row(organization_id, property_id)
    AND public.pass_on_can_manage_author(author)
  )
  WITH CHECK (
    public.auth_user_can_access_tenant_row(organization_id, property_id)
    AND public.pass_on_can_manage_author(author)
  );
CREATE POLICY tenant_pass_on_log_delete ON pass_on_log
  FOR DELETE TO authenticated
  USING (
    public.auth_user_can_access_tenant_row(organization_id, property_id)
    AND public.pass_on_can_manage_author(author)
  );

-- pass_on_log_replies
ALTER TABLE pass_on_log_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_pass_on_log_replies_select ON pass_on_log_replies
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pass_on_log_replies_insert ON pass_on_log_replies
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pass_on_log_replies_update ON pass_on_log_replies
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_can_access_tenant_row(organization_id, property_id)
    AND public.pass_on_can_manage_author(reply_author)
  )
  WITH CHECK (
    public.auth_user_can_access_tenant_row(organization_id, property_id)
    AND public.pass_on_can_manage_author(reply_author)
  );
CREATE POLICY tenant_pass_on_log_replies_delete ON pass_on_log_replies
  FOR DELETE TO authenticated
  USING (
    public.auth_user_can_access_tenant_row(organization_id, property_id)
    AND public.pass_on_can_manage_author(reply_author)
  );

-- pass_on_log_views
CREATE POLICY tenant_pass_on_log_views_select ON pass_on_log_views
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pass_on_log_views_insert ON pass_on_log_views
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_pass_on_log_views_update ON pass_on_log_views
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- scheduled reports (tenant-scoped; API isolation deferred to Checkpoint 6)
CREATE POLICY tenant_scheduled_report_schedules_select ON scheduled_report_schedules
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_scheduled_report_schedules_insert ON scheduled_report_schedules
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_scheduled_report_schedules_update ON scheduled_report_schedules
  FOR UPDATE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id))
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_scheduled_report_schedules_delete ON scheduled_report_schedules
  FOR DELETE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

CREATE POLICY tenant_scheduled_report_runs_select ON scheduled_report_runs
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_scheduled_report_runs_insert ON scheduled_report_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

-- team_members (membership-backed directory + manager writes)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_team_members_select ON team_members
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));
CREATE POLICY tenant_team_members_insert ON team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_team_member_can_manage_team()
    AND public.auth_user_can_access_tenant_row(organization_id, property_id)
  );
CREATE POLICY tenant_team_members_update ON team_members
  FOR UPDATE TO authenticated
  USING (
    public.auth_team_member_can_manage_team()
    AND public.auth_user_can_access_tenant_row(organization_id, property_id)
  )
  WITH CHECK (
    public.auth_team_member_can_manage_team()
    AND public.auth_user_can_access_tenant_row(organization_id, property_id)
  );
CREATE POLICY tenant_team_members_delete ON team_members
  FOR DELETE TO authenticated
  USING (
    public.auth_team_member_can_manage_team()
    AND public.auth_user_can_access_tenant_row(organization_id, property_id)
  );

COMMIT;

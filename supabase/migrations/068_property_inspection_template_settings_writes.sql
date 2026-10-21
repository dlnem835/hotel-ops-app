-- Restrict property inspection template writes to the canonical One Eyrie
-- membership model. Job titles never grant access.
--
-- SELECT stays membership-scoped so inspectors can list templates and start
-- inspections. INSERT/UPDATE/DELETE require the same organization/property
-- scope plus an active management grant:
--   • org_owner / org_admin — every active property in that organization
--   • property_admin — only the assigned property
--   • explicit Settings permission on that property
--
-- Inactive organization_users, user_properties, team_members, properties, or
-- organizations cannot grant writes. Historical inspection_sessions rows and
-- template_snapshot values are not modified.

BEGIN;

CREATE OR REPLACE FUNCTION public.auth_user_can_manage_property_inspection_templates(
  p_organization_id INT,
  p_property_id INT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.properties p
      JOIN public.organizations o
        ON o.id = p.organization_id
      WHERE p.id = p_property_id
        AND p.organization_id = p_organization_id
        AND p.active = true
        AND o.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.organization_id = p_organization_id
        AND ou.active = true
        AND (
          ou.role IN ('org_owner', 'org_admin')
          OR EXISTS (
            SELECT 1
            FROM public.user_properties up
            WHERE up.user_id = auth.uid()
              AND up.property_id = p_property_id
              AND up.active = true
              AND up.role = 'property_admin'
          )
          OR EXISTS (
            SELECT 1
            FROM public.user_properties up
            WHERE up.user_id = auth.uid()
              AND up.property_id = p_property_id
              AND up.active = true
              AND coalesce((up.module_permissions->>'settings')::boolean, false)
          )
          OR EXISTS (
            SELECT 1
            FROM public.team_members tm
            WHERE tm.auth_user_id = auth.uid()
              AND tm.organization_id = p_organization_id
              AND tm.property_id = p_property_id
              AND tm.status = 'Active'
              AND coalesce(tm.can_login, false) = true
              AND coalesce((tm.module_permissions->>'settings')::boolean, false)
          )
        )
    );
$$;

COMMENT ON FUNCTION public.auth_user_can_manage_property_inspection_templates(INT, INT) IS
  'True when the caller has an active org membership and may manage inspection templates for this organization/property: org_owner/org_admin (org-wide), property_admin (assigned property), or explicit Settings permission. Job titles are ignored.';

REVOKE ALL ON FUNCTION public.auth_user_can_manage_property_inspection_templates(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_can_manage_property_inspection_templates(INT, INT) TO authenticated;

DROP POLICY IF EXISTS tenant_property_inspection_templates_insert
  ON property_inspection_templates;
DROP POLICY IF EXISTS tenant_property_inspection_templates_update
  ON property_inspection_templates;
DROP POLICY IF EXISTS tenant_property_inspection_templates_delete
  ON property_inspection_templates;

CREATE POLICY tenant_property_inspection_templates_insert
  ON property_inspection_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_user_can_access_tenant_row(organization_id, property_id)
    AND public.auth_user_can_manage_property_inspection_templates(
      organization_id,
      property_id
    )
  );

CREATE POLICY tenant_property_inspection_templates_update
  ON property_inspection_templates
  FOR UPDATE TO authenticated
  USING (
    public.auth_user_can_access_tenant_row(organization_id, property_id)
    AND public.auth_user_can_manage_property_inspection_templates(
      organization_id,
      property_id
    )
  )
  WITH CHECK (
    public.auth_user_can_access_tenant_row(organization_id, property_id)
    AND public.auth_user_can_manage_property_inspection_templates(
      organization_id,
      property_id
    )
  );

CREATE POLICY tenant_property_inspection_templates_delete
  ON property_inspection_templates
  FOR DELETE TO authenticated
  USING (
    public.auth_user_can_access_tenant_row(organization_id, property_id)
    AND public.auth_user_can_manage_property_inspection_templates(
      organization_id,
      property_id
    )
  );

COMMIT;

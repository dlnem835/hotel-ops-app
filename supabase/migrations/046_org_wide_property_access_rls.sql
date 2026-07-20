-- Migration 046: Org-wide property access for Primary Owner + Organization Admin
-- Extends RLS helper so authenticated reads match resolveTenantContextForUser:
-- org_owner and org_admin may access every active property in their organization
-- without an explicit user_properties row per property.
-- Property Administrators (org_member) remain assigned-only via user_properties.

BEGIN;

CREATE OR REPLACE FUNCTION public.auth_user_has_property_access(p_property_id INT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM user_properties up
      WHERE up.user_id = auth.uid()
        AND up.property_id = p_property_id
        AND up.active = true
    )
    OR EXISTS (
      SELECT 1
      FROM properties p
      JOIN organization_users ou
        ON ou.organization_id = p.organization_id
       AND ou.user_id = auth.uid()
       AND ou.active = true
       AND ou.role IN ('org_owner', 'org_admin')
      WHERE p.id = p_property_id
        AND p.active = true
    );
$$;

COMMENT ON FUNCTION public.auth_user_has_property_access(INT) IS
  'True when the caller has an active user_properties row for the property, or an active org_owner/org_admin membership on the property''s organization.';

COMMIT;

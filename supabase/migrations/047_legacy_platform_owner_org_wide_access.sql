-- Migration 047: Legacy Platform Owner hotel memberships + RLS parity
-- Pre-multi-property seed accounts (e.g. dlnem360) were often stamped as
-- org_member with a single user_properties row. Active platform admins who also
-- hold hotel organization membership become Organization Admin (org-wide)
-- without changing an existing Primary Owner (org_owner) row.
-- RLS is extended so platform admins can access every active property in orgs
-- they belong to, matching resolveTenantContextForUser.

BEGIN;

-- Durable membership upgrade: org_member -> org_admin for active platform admins.
-- Never overwrite org_owner (Primary Owner).
UPDATE organization_users AS ou
SET
  role = 'org_admin',
  updated_at = now()
FROM platform_admins AS pa
WHERE pa.user_id = ou.user_id
  AND pa.active = true
  AND ou.active = true
  AND ou.role = 'org_member';

-- Align property membership role for those upgraded org memberships.
UPDATE user_properties AS up
SET
  role = 'property_admin',
  updated_at = now()
FROM organization_users AS ou
JOIN platform_admins AS pa
  ON pa.user_id = ou.user_id
 AND pa.active = true
WHERE up.user_id = ou.user_id
  AND ou.active = true
  AND ou.role IN ('org_admin', 'org_owner')
  AND up.active = true
  AND up.role = 'property_staff';

-- Mark matching team_members as administrators for UI/settings consistency.
UPDATE team_members AS tm
SET
  is_administrator = true
FROM organization_users AS ou
JOIN platform_admins AS pa
  ON pa.user_id = ou.user_id
 AND pa.active = true
WHERE tm.auth_user_id = ou.user_id
  AND tm.organization_id = ou.organization_id
  AND ou.active = true
  AND ou.role IN ('org_admin', 'org_owner')
  AND COALESCE(tm.is_administrator, false) = false;

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
    )
    OR EXISTS (
      SELECT 1
      FROM properties p
      JOIN organization_users ou
        ON ou.organization_id = p.organization_id
       AND ou.user_id = auth.uid()
       AND ou.active = true
      JOIN platform_admins pa
        ON pa.user_id = auth.uid()
       AND pa.active = true
      WHERE p.id = p_property_id
        AND p.active = true
    );
$$;

COMMENT ON FUNCTION public.auth_user_has_property_access(INT) IS
  'True when the caller has an active user_properties row, an org_owner/org_admin membership on the property org, or an active platform_admins row plus any active membership on that org.';

COMMIT;

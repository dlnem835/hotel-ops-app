-- Migration 050: Admin Portal organization-level module
--
-- Adds `admin_portal` as an organization-level availability control in
-- organization_modules. This is the ORG-level half of a two-key gate for the
-- customer Admin Portal (/admin-portal):
--
--   Access to /admin-portal requires BOTH:
--     1. organization_modules.admin_portal.enabled = true   (this migration)
--     2. organization_users.org_admin_portal_access = true  (migration 049)
--
-- Enabling the org module does NOT grant access to any user by itself; One Eyrie
-- Platform Admins still assign the per-user entitlement through each user's
-- Invite/Edit form. Disabling the org module blocks the Admin Portal for every
-- user in the organization even if they hold the individual entitlement.
--
-- Unlike the feature modules (dashboard, maintenance, …) this key is NOT a user
-- module permission: disabling it never rewrites user_properties/team_members
-- module_permissions. It only gates the Admin Portal entitlement.
--
-- Migration default: existing organizations receive admin_portal = ENABLED so
-- that members who already hold the entitlement (backfilled in 049) keep the
-- access they had before this control existed. New per-user grants remain
-- explicit.

BEGIN;

-- 1. Allow the new key in the CHECK constraint.
ALTER TABLE organization_modules
  DROP CONSTRAINT IF EXISTS organization_modules_key_check;

ALTER TABLE organization_modules
  ADD CONSTRAINT organization_modules_key_check CHECK (
    module_key IN (
      'dashboard',
      'reports',
      'lost_found',
      'pass_on',
      'inspections',
      'maintenance',
      'settings',
      'admin_portal'
    )
  );

-- 2. Seed function includes admin_portal for future organizations.
CREATE OR REPLACE FUNCTION public.seed_default_organization_modules(p_organization_id INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO organization_modules (organization_id, module_key, enabled)
  VALUES
    (p_organization_id, 'dashboard', true),
    (p_organization_id, 'reports', true),
    (p_organization_id, 'lost_found', true),
    (p_organization_id, 'pass_on', true),
    (p_organization_id, 'inspections', true),
    (p_organization_id, 'maintenance', true),
    (p_organization_id, 'settings', true),
    (p_organization_id, 'admin_portal', true)
  ON CONFLICT (organization_id, module_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_organization_modules(INT) FROM PUBLIC;

-- 3. Backfill an enabled admin_portal row for every existing organization so
--    current entitlement holders keep access.
INSERT INTO organization_modules (organization_id, module_key, enabled)
SELECT id, 'admin_portal', true
FROM organizations
ON CONFLICT (organization_id, module_key) DO NOTHING;

COMMIT;

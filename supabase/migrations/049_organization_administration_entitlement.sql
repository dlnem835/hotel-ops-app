-- Migration 049: Organization Administration entitlement
--
-- Introduces a dedicated, explicit user-level capability that governs access to
-- the customer-facing Organization Administration portal (/settings/organization).
--
-- This capability is intentionally SEPARATE from:
--   * internal authorization roles (organization_users.role / user_properties.role)
--   * Access Scope (org-wide vs. selected properties via user_properties)
--   * Primary Owner designation (organization_invitations.is_primary)
--   * job title
--
-- It is granted/revoked ONLY by One Eyrie Platform Administrators. Customer-facing
-- APIs must never write it. The internal /admin portal continues to be gated by
-- platform_admins; this flag only opens the customer portal.
--
-- Storage:
--   organization_users.org_admin_portal_access       -> effective, per accepted member
--   organization_invitations.org_admin_portal_access  -> intended value for pending invites
--
-- Migration default: existing users default to FALSE (disabled) so no one
-- accidentally gains access. As an INTENTIONAL one-time backfill (NOT runtime
-- inference), currently-active org-wide administrators (Primary Owner +
-- Organization Admin) are granted the entitlement so they retain the customer
-- portal access they already had before this feature existed.

BEGIN;

ALTER TABLE organization_users
  ADD COLUMN IF NOT EXISTS org_admin_portal_access BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE organization_invitations
  ADD COLUMN IF NOT EXISTS org_admin_portal_access BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN organization_users.org_admin_portal_access IS
  'Explicit One Eyrie-controlled entitlement: may open the customer Organization '
  'Administration portal. Independent of role, Access Scope, and Primary Owner.';

COMMENT ON COLUMN organization_invitations.org_admin_portal_access IS
  'Intended Organization Administration entitlement for this invitation; copied to '
  'organization_users on acceptance. One Eyrie-controlled only.';

-- Intentional migration: preserve existing portal access for active org-wide admins.
UPDATE organization_users
SET org_admin_portal_access = true
WHERE active = true
  AND role IN ('org_owner', 'org_admin');

-- Mirror onto accepted invitations for leadership-card display consistency.
UPDATE organization_invitations
SET org_admin_portal_access = true
WHERE status = 'accepted'
  AND org_role IN ('org_owner', 'org_admin');

COMMIT;

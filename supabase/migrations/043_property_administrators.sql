-- Migration 043: Multiple Property Administrators per organization
-- Redesigns the invitation lifecycle to support more than one administrator per
-- organization/property and a durable Primary Administrator designation.
--
-- Membership model (no redesign needed to scale):
--   organization_users.role
--     org_owner  -> Primary Owner        (org-wide: all active properties)
--     org_admin  -> Organization Admin   (org-wide: all active properties)
--     org_member -> property-scoped      (only explicit user_properties rows)
--   user_properties.role
--     property_admin -> Property Administrator (future roles may be added)
--
-- Scope is derived from the org role, so a user can administer one property,
-- several properties, or the whole organization without a schema change.

BEGIN;

-- ---------------------------------------------------------------------------
-- Invitation status: add 'cancelled' (pending/expired/revoked already exist).
-- ---------------------------------------------------------------------------
ALTER TABLE organization_invitations
  DROP CONSTRAINT IF EXISTS organization_invitations_status_check;

ALTER TABLE organization_invitations
  ADD CONSTRAINT organization_invitations_status_check
  CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled', 'revoked'));

-- ---------------------------------------------------------------------------
-- Primary Administrator designation. Durable + auditable. The first invited
-- administrator per organization is Primary (org_owner); additional admins are
-- Organization Admins (org_admin) or property-scoped Property Administrators.
-- ---------------------------------------------------------------------------
ALTER TABLE organization_invitations
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN organization_invitations.is_primary IS
  'True for the organization''s Primary Administrator (Primary Owner). Protected from disable/remove until primary transfer is supported.';

-- Backfill: the earliest invitation per organization becomes Primary, so the
-- existing single GM is preserved as the Primary Administrator.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM organization_invitations
)
UPDATE organization_invitations oi
SET is_primary = true
FROM ranked r
WHERE r.id = oi.id
  AND r.rn = 1;

-- ---------------------------------------------------------------------------
-- Pending-email uniqueness: scope to the organization so the same person can be
-- invited to different organizations, and re-invited after cancel/revoke/expire
-- (which move the row out of 'pending'). Prevents duplicate PENDING invites for
-- the same email within one organization.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS organization_invitations_pending_email_idx;

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_pending_email_org_idx
  ON organization_invitations (organization_id, lower(trim(email)))
  WHERE status = 'pending';

COMMIT;

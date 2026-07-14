-- 045_organization_invitation_assigned_properties.sql
-- Persist multi-property invitations for Organization Admins (selected properties).
-- property_id remains the default/landing property (first selected).

BEGIN;

ALTER TABLE organization_invitations
  ADD COLUMN IF NOT EXISTS assigned_property_ids INT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN organization_invitations.assigned_property_ids IS
  'Explicit property assignments for pending/accepted invitations. '
  'Empty array means fall back to property_id only. Primary Owners are org-wide '
  'and do not rely on this list for authorization.';

-- Backfill existing rows from the single property_id.
UPDATE organization_invitations
SET assigned_property_ids = ARRAY[property_id]
WHERE assigned_property_ids = '{}' OR assigned_property_ids IS NULL;

COMMIT;

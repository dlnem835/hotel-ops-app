-- Migration 038: Organization module entitlements + GM invitations
-- Stage A — schema for subscription licensing and onboarding workflow.

BEGIN;

-- ---------------------------------------------------------------------------
-- organization_modules — per-org enabled modules (subscription / licensing)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organization_modules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_key      TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_modules_key_check CHECK (
    module_key IN (
      'dashboard',
      'reports',
      'lost_found',
      'pass_on',
      'inspections',
      'maintenance',
      'settings'
    )
  ),
  CONSTRAINT organization_modules_unique UNIQUE (organization_id, module_key)
);

CREATE INDEX IF NOT EXISTS organization_modules_org_idx
  ON organization_modules (organization_id);

COMMENT ON TABLE organization_modules IS
  'Org-level module entitlements. New orgs receive all modules via seed_default_organization_modules().';

-- ---------------------------------------------------------------------------
-- organization_invitations — first-GM and future invite tracking
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS organization_invitations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  property_id        INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  email              TEXT NOT NULL,
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  org_role           TEXT NOT NULL DEFAULT 'org_owner',
  property_role      TEXT NOT NULL DEFAULT 'property_admin',
  job_title          TEXT NOT NULL DEFAULT 'General Manager',
  status             TEXT NOT NULL DEFAULT 'pending',
  invited_by         UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  auth_user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  supabase_invite_id TEXT,
  expires_at         TIMESTAMPTZ,
  accepted_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_invitations_status_check CHECK (
    status IN ('pending', 'accepted', 'expired', 'revoked')
  ),
  CONSTRAINT organization_invitations_org_role_check CHECK (
    org_role IN ('org_owner', 'org_admin', 'org_member', 'org_billing')
  ),
  CONSTRAINT organization_invitations_property_role_check CHECK (
    property_role IN (
      'property_admin',
      'property_manager',
      'property_supervisor',
      'property_staff',
      'property_read_only'
    )
  )
);

CREATE INDEX IF NOT EXISTS organization_invitations_org_idx
  ON organization_invitations (organization_id);

CREATE INDEX IF NOT EXISTS organization_invitations_property_idx
  ON organization_invitations (property_id);

CREATE INDEX IF NOT EXISTS organization_invitations_status_idx
  ON organization_invitations (status);

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_pending_email_idx
  ON organization_invitations (lower(trim(email)))
  WHERE status = 'pending';

COMMENT ON TABLE organization_invitations IS
  'Tracks GM invitations sent via Supabase Auth inviteUserByEmail.';

-- ---------------------------------------------------------------------------
-- Seed all current modules for a new organization (licensing-ready default)
-- ---------------------------------------------------------------------------

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
    (p_organization_id, 'settings', true)
  ON CONFLICT (organization_id, module_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_organization_modules(INT) FROM PUBLIC;

-- Backfill pilot org (id=1) with all modules enabled for licensing consistency.
SELECT public.seed_default_organization_modules(1);

COMMIT;

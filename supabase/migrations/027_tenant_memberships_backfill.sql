-- Migration 027: Membership tables + pilot backfill from team_members
-- Applied to Supabase (Checkpoint 2).

BEGIN;

CREATE TABLE IF NOT EXISTS organization_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organization_users_unique UNIQUE (organization_id, user_id),
  CONSTRAINT organization_users_role_check CHECK (
    role IN ('org_owner', 'org_admin', 'org_member', 'org_billing')
  )
);

CREATE INDEX IF NOT EXISTS organization_users_user_id_idx ON organization_users (user_id);
CREATE INDEX IF NOT EXISTS organization_users_org_active_idx ON organization_users (organization_id, active);

CREATE TABLE IF NOT EXISTS user_properties (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id        INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  role               TEXT NOT NULL,
  is_default         BOOLEAN NOT NULL DEFAULT false,
  active             BOOLEAN NOT NULL DEFAULT true,
  module_permissions JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_properties_unique UNIQUE (user_id, property_id),
  CONSTRAINT user_properties_role_check CHECK (
    role IN (
      'property_admin',
      'property_manager',
      'property_supervisor',
      'property_staff',
      'property_read_only'
    )
  )
);

CREATE INDEX IF NOT EXISTS user_properties_user_active_idx ON user_properties (user_id, active);
CREATE INDEX IF NOT EXISTS user_properties_property_active_idx ON user_properties (property_id, active);

CREATE UNIQUE INDEX IF NOT EXISTS user_properties_one_default_per_user
  ON user_properties (user_id)
  WHERE is_default = true AND active = true;

-- Backfill organization membership for all login users in pilot org.
INSERT INTO organization_users (organization_id, user_id, role, active)
SELECT
  1,
  tm.auth_user_id,
  CASE WHEN coalesce(tm.is_administrator, false) THEN 'org_admin' ELSE 'org_member' END,
  true
FROM team_members tm
WHERE tm.auth_user_id IS NOT NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Backfill property membership from team_members.property_id.
INSERT INTO user_properties (
  user_id,
  property_id,
  role,
  is_default,
  active,
  module_permissions
)
SELECT
  tm.auth_user_id,
  coalesce(tm.property_id, 1),
  CASE
    WHEN coalesce(tm.is_administrator, false) THEN 'property_admin'
    ELSE 'property_staff'
  END,
  true,
  true,
  tm.module_permissions
FROM team_members tm
WHERE tm.auth_user_id IS NOT NULL
ON CONFLICT (user_id, property_id) DO NOTHING;

COMMIT;

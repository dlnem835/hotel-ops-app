-- Migration 037: Platform administrators (One Eyrie internal SaaS admin portal)
-- Apply after migrations 026–036. Stage A — schema only.
-- The first platform_owner is inserted manually (see 041_platform_owner_seed.sql).

BEGIN;

CREATE TABLE IF NOT EXISTS platform_admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT platform_admins_role_check CHECK (
    role IN ('platform_owner', 'platform_admin')
  )
);

CREATE INDEX IF NOT EXISTS platform_admins_user_id_idx
  ON platform_admins (user_id);

CREATE INDEX IF NOT EXISTS platform_admins_active_user_idx
  ON platform_admins (user_id)
  WHERE active = true;

COMMENT ON TABLE platform_admins IS
  'One Eyrie platform operators. Separate from hotel organization_users roles.';

COMMIT;

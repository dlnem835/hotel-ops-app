-- Migration 042: Invited-user first-login account setup state
-- Adds durable, server-validated onboarding state for invited users.
-- Existing users are unaffected: absence of a row = account setup complete.

BEGIN;

-- ---------------------------------------------------------------------------
-- user_profiles — account-level identity + onboarding state (per auth user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name              TEXT,
  last_name               TEXT,
  username                TEXT,
  username_normalized     TEXT,
  appearance_preference   TEXT NOT NULL DEFAULT 'dark',
  account_setup_completed BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_appearance_check CHECK (
    appearance_preference IN ('dark', 'light')
  )
);

-- Global username uniqueness (case/spacing normalized upstream). Partial so
-- rows without a username (invited users pre-setup) do not collide.
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_normalized_key
  ON user_profiles (username_normalized)
  WHERE username_normalized IS NOT NULL;

COMMENT ON TABLE user_profiles IS
  'Account-level identity + onboarding state. Missing row implies setup complete (legacy users).';
COMMENT ON COLUMN user_profiles.account_setup_completed IS
  'Server-validated gate. False blocks hotel data access until first-login setup finishes.';

-- ---------------------------------------------------------------------------
-- RLS: service-role only. No authenticated policies — the app reads/writes
-- this table exclusively through server routes using the service role, which
-- bypasses RLS. Fails closed for any direct client access.
-- ---------------------------------------------------------------------------

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Backfill: only genuinely-incomplete invited users become 'incomplete'.
-- Targets accepted invitations whose team_members profile still lacks a
-- username (i.e. never completed first-login setup). Legacy staff are skipped.
-- ---------------------------------------------------------------------------

INSERT INTO user_profiles (
  user_id,
  first_name,
  last_name,
  username,
  username_normalized,
  appearance_preference,
  account_setup_completed
)
SELECT DISTINCT ON (oi.auth_user_id)
  oi.auth_user_id,
  oi.first_name,
  oi.last_name,
  NULL,
  NULL,
  'dark',
  false
FROM organization_invitations oi
JOIN team_members tm ON tm.auth_user_id = oi.auth_user_id
WHERE oi.status = 'accepted'
  AND oi.auth_user_id IS NOT NULL
  AND (tm.username IS NULL OR btrim(tm.username) = '')
ORDER BY oi.auth_user_id, oi.accepted_at DESC NULLS LAST
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

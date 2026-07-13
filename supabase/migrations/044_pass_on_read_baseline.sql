-- Migration 044: Pass-On Log read baseline (per user, per property)
--
-- Problem: a newly created user inherited the entire historical Pass-On Log as
-- unread, because unread = "no view row" and new users have no view rows for old
-- entries.
--
-- Fix: give each membership a durable read baseline. Entries created before the
-- baseline are treated as already read for that user; only entries created after
-- it are eligible to appear unread. The baseline is the later of the user's
-- account creation and the moment they received property membership — which, at
-- INSERT time, is always `now()` (the membership row cannot exist before the
-- referenced auth user). We therefore set it via a BEFORE INSERT trigger.
--
-- Backward compatibility: existing user_properties rows are left NULL (no
-- backfill). A NULL baseline means "behave exactly as before" — the client
-- treats missing baselines as no cutoff, so existing users' read/unread history
-- is unchanged. Only memberships created from now on get a baseline.
--
-- This is a single per-user/per-property timestamp; it intentionally avoids
-- creating a view row for every historical entry.

BEGIN;

ALTER TABLE user_properties
  ADD COLUMN IF NOT EXISTS pass_on_read_baseline TIMESTAMPTZ;

COMMENT ON COLUMN user_properties.pass_on_read_baseline IS
  'Pass-On Log unread cutoff for this user+property. Entries created before this are treated as read. NULL = legacy membership (pre-044), no cutoff.';

CREATE OR REPLACE FUNCTION set_user_properties_pass_on_baseline()
RETURNS TRIGGER AS $$
BEGIN
  -- Only stamp on initial creation and only when not explicitly provided, so
  -- re-activations / role changes (which arrive as UPDATEs) never reset it.
  IF NEW.pass_on_read_baseline IS NULL THEN
    NEW.pass_on_read_baseline := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_properties_pass_on_baseline ON user_properties;

CREATE TRIGGER trg_user_properties_pass_on_baseline
  BEFORE INSERT ON user_properties
  FOR EACH ROW
  EXECUTE FUNCTION set_user_properties_pass_on_baseline();

COMMIT;

-- Migration 048: Split organization legal identity from operational profile.
--
-- (Renumbered from a colliding 047 prefix; 047 is the legacy platform-owner
-- org-wide access migration, which stays untouched.)
--
-- Legal identity (legal_name, slug, id, status) stays a One Eyrie Platform
-- Administration concern to preserve billing integrity, contracts, licensing,
-- and account verification. Customers (Organization Administrators) may edit the
-- operational profile only: display name (`name`), contact email/phone, mailing
-- or business address, and an operational contact person.
--
-- `name` keeps its existing meaning as the DISPLAY name shown throughout the app.
-- `legal_name` is new and One Eyrie-controlled; it is backfilled to the current
-- name so existing organizations start with a concrete legal identity value.

BEGIN;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS legal_name       TEXT,
  ADD COLUMN IF NOT EXISTS contact_email    TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone    TEXT,
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS contact_name     TEXT;

-- Seed legal_name from the current display name for existing organizations.
UPDATE organizations
SET legal_name = name
WHERE legal_name IS NULL;

COMMIT;

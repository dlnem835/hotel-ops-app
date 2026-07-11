-- CHECKPOINT 2 — REVIEW ONLY. DO NOT APPLY until approved after Checkpoint 1 review.
-- Migration 026: Canonical tenant root tables + migrate hotel_property → properties

BEGIN;

CREATE TABLE IF NOT EXISTS organizations (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_unique UNIQUE (slug),
  CONSTRAINT organizations_status_check CHECK (status IN ('active', 'inactive', 'suspended'))
);

CREATE TABLE IF NOT EXISTS properties (
  id              INT PRIMARY KEY,
  organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name            TEXT NOT NULL,
  brand           TEXT,
  address         TEXT NOT NULL DEFAULT '',
  phone_number    TEXT NOT NULL DEFAULT '',
  timezone        TEXT NOT NULL DEFAULT 'America/New_York',
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT properties_org_name_unique UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS properties_organization_id_idx ON properties (organization_id);
CREATE INDEX IF NOT EXISTS properties_active_idx ON properties (organization_id, active);

INSERT INTO organizations (id, name, slug, status)
VALUES (1, 'One Eyrie Pilot Organization', 'one-eyrie-pilot', 'active')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('organizations', 'id'), GREATEST((SELECT MAX(id) FROM organizations), 1));

INSERT INTO properties (
  id,
  organization_id,
  name,
  brand,
  address,
  phone_number,
  timezone,
  active,
  created_at,
  updated_at
)
SELECT
  hp.id,
  1,
  COALESCE(NULLIF(trim(hp.hotel_name), ''), 'SpringHill Suites Tampa Suncoast Parkway'),
  NULL,
  COALESCE(hp.address, ''),
  COALESCE(hp.phone_number, ''),
  'America/New_York',
  true,
  COALESCE(hp.updated_at, now()),
  COALESCE(hp.updated_at, now())
FROM hotel_property hp
WHERE hp.id = 1
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone_number = EXCLUDED.phone_number,
  timezone = EXCLUDED.timezone,
  active = EXCLUDED.active,
  updated_at = now();

COMMIT;

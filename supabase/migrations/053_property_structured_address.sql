-- Migration 053: Structured property addresses (canonical Ship From source)
--
-- Adds address_line1/2, city, state, postal, country on properties.
-- Backfills from legacy properties.address and property_shipping_settings.
-- Keeps properties.address as a denormalized single-line display field.

BEGIN;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS address_line1 TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_line2 TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_state TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_postal TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address_country TEXT NOT NULL DEFAULT 'US';

-- Best-effort parse of legacy single-line addresses into structured fields.
DO $$
DECLARE
  r RECORD;
  parts TEXT[];
  last_part TEXT;
  state_zip TEXT[];
  city_state TEXT[];
  line1 TEXT;
  line2 TEXT;
  city TEXT;
  state TEXT;
  postal TEXT;
  before_last TEXT[];
BEGIN
  FOR r IN
    SELECT id, address
    FROM public.properties
    WHERE COALESCE(TRIM(address), '') <> ''
      AND COALESCE(TRIM(address_line1), '') = ''
  LOOP
    parts := ARRAY(
      SELECT TRIM(p)
      FROM unnest(string_to_array(r.address, ',')) AS p
      WHERE TRIM(p) <> ''
    );

    line1 := '';
    line2 := '';
    city := '';
    state := '';
    postal := '';

    IF array_length(parts, 1) IS NULL THEN
      CONTINUE;
    ELSIF array_length(parts, 1) = 1 THEN
      line1 := parts[1];
    ELSE
      last_part := parts[array_length(parts, 1)];
      before_last := parts[1:array_length(parts, 1) - 1];

      -- "ST 12345" or "ST 12345-6789"
      IF last_part ~ '^[A-Za-z]{2}\s+\d{5}(-\d{4})?$' THEN
        state_zip := regexp_match(last_part, '^([A-Za-z]{2})\s+(\d{5}(-\d{4})?)$');
        state := upper(state_zip[1]);
        postal := state_zip[2];
      ELSIF last_part ~ '^\d{5}(-\d{4})?$' AND array_length(before_last, 1) >= 1 THEN
        postal := last_part;
        city_state := regexp_match(
          before_last[array_length(before_last, 1)],
          '^(.*)\s+([A-Za-z]{2})$'
        );
        IF city_state IS NOT NULL THEN
          before_last := before_last[1:array_length(before_last, 1) - 1] || ARRAY[TRIM(city_state[1])];
          state := upper(city_state[2]);
        END IF;
      ELSIF last_part ~ '^[A-Za-z]{2}$' THEN
        state := upper(last_part);
      END IF;

      IF array_length(before_last, 1) >= 1 THEN
        city := before_last[array_length(before_last, 1)];
        IF array_length(before_last, 1) >= 2 THEN
          line1 := before_last[1];
          IF array_length(before_last, 1) >= 3 THEN
            line2 := array_to_string(before_last[2:array_length(before_last, 1) - 1], ', ');
          END IF;
        ELSE
          line1 := r.address;
          city := '';
        END IF;
      ELSE
        line1 := r.address;
      END IF;
    END IF;

    UPDATE public.properties
    SET
      address_line1 = COALESCE(NULLIF(TRIM(line1), ''), TRIM(r.address)),
      address_line2 = COALESCE(NULLIF(TRIM(line2), ''), ''),
      address_city = COALESCE(NULLIF(TRIM(city), ''), ''),
      address_state = COALESCE(NULLIF(TRIM(state), ''), ''),
      address_postal = COALESCE(NULLIF(TRIM(postal), ''), ''),
      address_country = 'US'
    WHERE id = r.id;
  END LOOP;
END $$;

-- Prefer structured ship-from from shipping settings when property still incomplete.
UPDATE public.properties p
SET
  address_line1 = CASE
    WHEN COALESCE(TRIM(p.address_line1), '') = '' THEN COALESCE(TRIM(s.ship_from_line1), '')
    ELSE p.address_line1
  END,
  address_line2 = CASE
    WHEN COALESCE(TRIM(p.address_line1), '') = '' THEN COALESCE(TRIM(s.ship_from_line2), '')
    ELSE p.address_line2
  END,
  address_city = CASE
    WHEN COALESCE(TRIM(p.address_line1), '') = '' THEN COALESCE(TRIM(s.ship_from_city), '')
    ELSE p.address_city
  END,
  address_state = CASE
    WHEN COALESCE(TRIM(p.address_line1), '') = '' THEN COALESCE(TRIM(s.ship_from_state), '')
    ELSE p.address_state
  END,
  address_postal = CASE
    WHEN COALESCE(TRIM(p.address_line1), '') = '' THEN COALESCE(TRIM(s.ship_from_postal), '')
    ELSE p.address_postal
  END,
  address_country = CASE
    WHEN COALESCE(TRIM(p.address_line1), '') = '' THEN COALESCE(NULLIF(TRIM(s.ship_from_country), ''), 'US')
    ELSE p.address_country
  END
FROM public.property_shipping_settings s
WHERE s.property_id = p.id
  AND COALESCE(TRIM(s.ship_from_line1), '') <> ''
  AND (
    COALESCE(TRIM(p.address_line1), '') = ''
    OR COALESCE(TRIM(p.address_city), '') = ''
    OR COALESCE(TRIM(p.address_postal), '') = ''
  );

-- Refresh denormalized single-line address from structured fields when possible.
UPDATE public.properties
SET address = TRIM(BOTH ', ' FROM CONCAT_WS(
  ', ',
  NULLIF(TRIM(address_line1), ''),
  NULLIF(TRIM(address_line2), ''),
  NULLIF(
    TRIM(CONCAT_WS(', ', NULLIF(TRIM(address_city), ''), NULLIF(TRIM(address_state), ''))),
    ''
  ),
  NULLIF(TRIM(address_postal), '')
))
WHERE COALESCE(TRIM(address_line1), '') <> '';

COMMIT;

-- Migration 033: Temporary hotel_property compatibility view (removed in Checkpoint 8)
-- Applied to Supabase (Checkpoint 2).
BEGIN;

CREATE OR REPLACE VIEW hotel_property_compat AS
SELECT
  p.id,
  p.name AS hotel_name,
  p.address,
  p.phone_number,
  p.updated_at
FROM properties p;

COMMENT ON VIEW hotel_property_compat IS
  'Temporary Checkpoint 2-7 compatibility shim. Maps legacy hotel_property reads to properties. Removed in Checkpoint 8.';

COMMIT;

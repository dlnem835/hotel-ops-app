-- Migration 034: Remove hotel_property compatibility shim (Checkpoint 8)
-- Apply after application code no longer reads/writes hotel_property.
-- Drops the temporary compat view from 033 and the legacy singleton table from 011.

BEGIN;

DROP VIEW IF EXISTS hotel_property_compat;

DROP POLICY IF EXISTS "Authenticated users can read hotel_property" ON hotel_property;
DROP POLICY IF EXISTS "Authenticated users can update hotel_property" ON hotel_property;

DROP TABLE IF EXISTS hotel_property;

COMMIT;

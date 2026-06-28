-- Hotel property identity for Settings → Rooms & Areas
-- Run after 001_buildings_and_areas.sql

CREATE TABLE IF NOT EXISTS hotel_property (
  id INT PRIMARY KEY DEFAULT 1,
  hotel_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone_number TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hotel_property_singleton CHECK (id = 1)
);

INSERT INTO hotel_property (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE hotel_property ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read hotel_property"
  ON hotel_property FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update hotel_property"
  ON hotel_property FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

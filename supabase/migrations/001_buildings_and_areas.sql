-- Master location database for One Eyrie (Rooms & Areas)
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS buildings_and_areas (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  area_type TEXT NOT NULL,
  floor_location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active',
  inspection_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT buildings_and_areas_name_unique UNIQUE (name),
  CONSTRAINT buildings_and_areas_status_check CHECK (
    status IN ('Active', 'Out of Service', 'Inactive')
  ),
  CONSTRAINT buildings_and_areas_area_type_check CHECK (
    area_type IN (
      'Guest Room',
      'Public Area',
      'Back Of House',
      'Mechanical',
      'Exterior'
    )
  )
);

CREATE INDEX IF NOT EXISTS buildings_and_areas_area_type_idx
  ON buildings_and_areas (area_type);

CREATE INDEX IF NOT EXISTS buildings_and_areas_status_idx
  ON buildings_and_areas (status);

ALTER TABLE buildings_and_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read buildings_and_areas"
  ON buildings_and_areas
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert buildings_and_areas"
  ON buildings_and_areas
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update buildings_and_areas"
  ON buildings_and_areas
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete buildings_and_areas"
  ON buildings_and_areas
  FOR DELETE
  TO authenticated
  USING (true);

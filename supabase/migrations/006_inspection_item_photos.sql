-- Per-item deficiency photos for inspection failures
-- Run after 005_inspection_summary_settings.sql

ALTER TABLE inspection_item_responses
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Supabase Storage bucket for inspection deficiency photos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read inspection photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inspection-photos');

CREATE POLICY "Authenticated upload inspection photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inspection-photos');

CREATE POLICY "Authenticated update inspection photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'inspection-photos')
  WITH CHECK (bucket_id = 'inspection-photos');

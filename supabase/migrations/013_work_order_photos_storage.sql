-- Work order photo attachments (manual create + linked deficiencies)
-- Run after 012_work_order_photo_url.sql

INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-photos', 'work-order-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read work order photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'work-order-photos');

CREATE POLICY "Authenticated upload work order photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'work-order-photos');

CREATE POLICY "Authenticated update work order photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'work-order-photos')
  WITH CHECK (bucket_id = 'work-order-photos');

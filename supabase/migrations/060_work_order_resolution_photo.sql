ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS resolution_photo_url text;

COMMENT ON COLUMN public.work_orders.resolution_photo_url IS
  'Optional completion photo uploaded with the required work order resolution.';

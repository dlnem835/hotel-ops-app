-- Multi-photo attachments for work orders (append-only after create).
-- Keeps legacy work_orders.photo_url / resolution_photo_url intact.

BEGIN;

CREATE TABLE IF NOT EXISTS public.work_order_photos (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  organization_id INT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  storage_path TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_order_photos_work_order_idx
  ON public.work_order_photos (work_order_id, uploaded_at);

CREATE INDEX IF NOT EXISTS work_order_photos_tenant_idx
  ON public.work_order_photos (organization_id, property_id);

ALTER TABLE public.work_order_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_work_order_photos_select ON public.work_order_photos;
CREATE POLICY tenant_work_order_photos_select
  ON public.work_order_photos
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_work_order_photos_insert ON public.work_order_photos;
CREATE POLICY tenant_work_order_photos_insert
  ON public.work_order_photos
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_work_order_photos_delete ON public.work_order_photos;
CREATE POLICY tenant_work_order_photos_delete
  ON public.work_order_photos
  FOR DELETE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

COMMIT;

-- Migration 036: Tenant storage path isolation (Checkpoint 5)
-- Scope storage.objects policies to org-{orgId}/property-{propertyId}/ prefixes.
-- Apply after 035_tenant_row_level_security.sql.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('shipping-labels', 'shipping-labels', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Storage helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_can_access_storage_path(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_properties up
    INNER JOIN properties p ON p.id = up.property_id
    WHERE up.user_id = auth.uid()
      AND up.active = true
      AND object_name LIKE (
        'org-' || p.organization_id::text || '/property-' || up.property_id::text || '/%'
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_guest_can_upload_shipping_label(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM lost_items li
    WHERE object_name LIKE (
      'org-' || li.organization_id::text
      || '/property-' || li.property_id::text
      || '/' || li.id::text || '-%'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_legacy_storage_read_allowed(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT (object_name LIKE 'org-%/property-%/%')
    AND EXISTS (
      SELECT 1 FROM user_properties up
      WHERE up.user_id = auth.uid() AND up.active = true
    );
$$;

REVOKE ALL ON FUNCTION public.auth_user_can_access_storage_path(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_guest_can_upload_shipping_label(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_legacy_storage_read_allowed(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_can_access_storage_path(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_guest_can_upload_shipping_label(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auth_legacy_storage_read_allowed(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Drop legacy bucket-wide storage policies
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'Public read inspection photos',
        'Authenticated upload inspection photos',
        'Authenticated update inspection photos',
        'Public read work order photos',
        'Authenticated upload work order photos',
        'Authenticated update work order photos'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- inspection-photos + PM photos share this bucket
CREATE POLICY tenant_inspection_photos_select ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (
    bucket_id = 'inspection-photos'
    AND (
      public.auth_user_can_access_storage_path(name)
      OR public.auth_legacy_storage_read_allowed(name)
    )
  );

CREATE POLICY tenant_inspection_photos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND public.auth_user_can_access_storage_path(name)
  );

CREATE POLICY tenant_inspection_photos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND public.auth_user_can_access_storage_path(name)
  )
  WITH CHECK (
    bucket_id = 'inspection-photos'
    AND public.auth_user_can_access_storage_path(name)
  );

CREATE POLICY tenant_inspection_photos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND public.auth_user_can_access_storage_path(name)
  );

-- work-order-photos
CREATE POLICY tenant_work_order_photos_select ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (
    bucket_id = 'work-order-photos'
    AND (
      public.auth_user_can_access_storage_path(name)
      OR public.auth_legacy_storage_read_allowed(name)
    )
  );

CREATE POLICY tenant_work_order_photos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-order-photos'
    AND public.auth_user_can_access_storage_path(name)
  );

CREATE POLICY tenant_work_order_photos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND public.auth_user_can_access_storage_path(name)
  )
  WITH CHECK (
    bucket_id = 'work-order-photos'
    AND public.auth_user_can_access_storage_path(name)
  );

CREATE POLICY tenant_work_order_photos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND public.auth_user_can_access_storage_path(name)
  );

-- shipping-labels (guest upload via /api/upload-label + authenticated reads)
CREATE POLICY tenant_shipping_labels_select ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (
    bucket_id = 'shipping-labels'
    AND (
      public.auth_user_can_access_storage_path(name)
      OR public.auth_guest_can_upload_shipping_label(name)
      OR public.auth_legacy_storage_read_allowed(name)
    )
  );

CREATE POLICY tenant_shipping_labels_insert ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'shipping-labels'
    AND (
      public.auth_user_can_access_storage_path(name)
      OR public.auth_guest_can_upload_shipping_label(name)
    )
  );

CREATE POLICY tenant_shipping_labels_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shipping-labels'
    AND public.auth_user_can_access_storage_path(name)
  )
  WITH CHECK (
    bucket_id = 'shipping-labels'
    AND public.auth_user_can_access_storage_path(name)
  );

COMMIT;

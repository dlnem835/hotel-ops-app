-- Migration 069: Private operational photo storage
--
-- Make inspection-photos (inspections + PM + RPM) and work-order-photos
-- private. Recreate SELECT policies as authenticated-only with tenant path
-- prefix checks. Remove anonymous SELECT and auth_legacy_storage_read_allowed
-- from these two buckets.
--
-- Existing objects are not moved, renamed, copied, or rewritten. Historical
-- unprefixed paths stay in place; the application authorizes them through
-- tenant-scoped parent records and service-role signed URLs.
--
-- Scope lock: this file updates only inspection-photos and work-order-photos.
-- Do not drop public.auth_legacy_storage_read_allowed. Do not change
-- shipping-labels, pass-on-attachments, or lost-found-shipping-labels.
--
-- Apply only after the Phase A/B application (signed display URLs, no
-- public fallbacks) is deployed. Do not apply from a local worktree.

BEGIN;

UPDATE storage.buckets
SET public = false
WHERE id IN ('inspection-photos', 'work-order-photos');

DROP POLICY IF EXISTS tenant_inspection_photos_select ON storage.objects;
DROP POLICY IF EXISTS tenant_work_order_photos_select ON storage.objects;

CREATE POLICY tenant_inspection_photos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inspection-photos'
    AND public.auth_user_can_access_storage_path(name)
  );

CREATE POLICY tenant_work_order_photos_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND public.auth_user_can_access_storage_path(name)
  );

COMMIT;

/*
ROLLBACK (do not run as part of this migration)

Restore public buckets and the 036 SELECT policies if this change must be
reverted. Signed application URLs still work on public buckets; rollback of
the app to a public-URL client while these buckets stay private would break
photo display. Object bytes are not restored from backup because they were
never moved.

BEGIN;

UPDATE storage.buckets
SET public = true
WHERE id IN ('inspection-photos', 'work-order-photos');

DROP POLICY IF EXISTS tenant_inspection_photos_select ON storage.objects;
DROP POLICY IF EXISTS tenant_work_order_photos_select ON storage.objects;

CREATE POLICY tenant_inspection_photos_select ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (
    bucket_id = 'inspection-photos'
    AND (
      public.auth_user_can_access_storage_path(name)
      OR public.auth_legacy_storage_read_allowed(name)
    )
  );

CREATE POLICY tenant_work_order_photos_select ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (
    bucket_id = 'work-order-photos'
    AND (
      public.auth_user_can_access_storage_path(name)
      OR public.auth_legacy_storage_read_allowed(name)
    )
  );

COMMIT;
*/

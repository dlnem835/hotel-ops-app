# Security Fix #3 — Phase B (private operational photo storage)

Workspace: `C:\Users\Douglas\hotel-ops-app-phase-a`  
Server: `http://localhost:3001`  
Do not commit, push, merge, or deploy from this document until explicitly approved.

Phase B application changes are prepared in this isolated worktree. Migration **069 is on disk and has not been executed**. Live Supabase bucket settings and policies have not been changed.

## What Phase B changes

1. Operational photo display fails closed. `resolveOperationalPhotoDisplayUrl` signs a tenant-authorized object or returns `null`. There is no public URL fallback for prefixed or unprefixed photos.
2. Inspection, PM, and work-order photo upload APIs return a signed `photoUrl` plus `storagePath`. They no longer return a storage path as a display URL. Signing failure after a successful inspection/PM upload, or before a work-order browser upload, returns HTTP 500.
3. Migration `supabase/migrations/069_private_operational_photo_storage.sql`:
   - Sets `inspection-photos` and `work-order-photos` to `public = false`.
   - Recreates SELECT policies as `TO authenticated` with `auth_user_can_access_storage_path(name)` only.
   - Removes anonymous SELECT and `auth_legacy_storage_read_allowed` from those two buckets.
   - Does not drop `auth_legacy_storage_read_allowed` (shipping-labels still uses it).
   - Does not change `shipping-labels`, `pass-on-attachments`, or `lost-found-shipping-labels`.
   - Does not move, rename, or rewrite existing objects.

Existing photos remain in place. Historical unprefixed paths are still authorized only through a tenant-scoped parent record and service-role signed URLs.

## Deployment sequence

Do not apply 069 until the Phase A/B application is running in the target environment. Production at this writing still uses public object URLs; applying 069 first would break photo display.

1. Deploy this application (Phase A signed URLs + Phase B fail-closed display) to the target environment. Confirm inspection, PM, work-order, Reports, print, and PDF photos load through signed URLs. Confirm `/api/storage/operational-photo/refresh` still works.
2. Apply migration 069 **once** against that environment’s Supabase project (`supabase db push` / dashboard SQL editor). Do not run it from this local worktree as a side effect of testing.
3. Immediately verify:
   - Authenticated users still see their own photos (upload, preview, history, refresh, Reports, print, PDF).
   - Unauthenticated `https://<project>.supabase.co/storage/v1/object/public/inspection-photos/...` and `.../work-order-photos/...` no longer return objects.
   - A signed-in user from another organization or property cannot load a photo they do not own via app APIs or Storage SELECT.
   - Unprefixed historical photos still display when they belong to the current tenant parent, and still fail closed otherwise.

## Rollback procedure

Rollback 069 only. Do not delete, move, or rewrite stored photos.

```sql
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
```

After that rollback:

- Signed application URLs continue to work (they work on public buckets).
- Anonymous public object URLs become readable again — that is the security regression being rolled back.
- Do not roll the application back to a public-URL client while 069 remains applied. That combination cannot display operational photos.

## Out of scope

- `shipping-labels` remains public and is not part of this fix. See
  `docs/security-shipping-labels-privacy.md` for a separate remediation plan.
- Reports detail/print/PDF work in this worktree must ship separately from
  photo security.
- No live bucket or policy changes from this worktree.
- No production deploy, commit, merge, or push until explicitly approved.

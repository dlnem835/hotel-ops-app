-- Secure files attached to Pass-On Log entries.
BEGIN;

CREATE TABLE IF NOT EXISTS public.pass_on_log_attachments (
  id BIGSERIAL PRIMARY KEY,
  entry_id INT NOT NULL REFERENCES public.pass_on_log(id) ON DELETE CASCADE,
  organization_id INT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pass_on_log_attachments_entry_idx
  ON public.pass_on_log_attachments (entry_id, created_at);

CREATE INDEX IF NOT EXISTS pass_on_log_attachments_tenant_idx
  ON public.pass_on_log_attachments (organization_id, property_id);

ALTER TABLE public.pass_on_log_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_pass_on_attachments_select
  ON public.pass_on_log_attachments;
CREATE POLICY tenant_pass_on_attachments_select
  ON public.pass_on_log_attachments
  FOR SELECT TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_pass_on_attachments_insert
  ON public.pass_on_log_attachments;
CREATE POLICY tenant_pass_on_attachments_insert
  ON public.pass_on_log_attachments
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_user_can_access_tenant_row(organization_id, property_id));

DROP POLICY IF EXISTS tenant_pass_on_attachments_delete
  ON public.pass_on_log_attachments;
CREATE POLICY tenant_pass_on_attachments_delete
  ON public.pass_on_log_attachments
  FOR DELETE TO authenticated
  USING (public.auth_user_can_access_tenant_row(organization_id, property_id));

INSERT INTO storage.buckets (id, name, public)
VALUES ('pass-on-attachments', 'pass-on-attachments', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS tenant_pass_on_attachments_storage_select ON storage.objects;
CREATE POLICY tenant_pass_on_attachments_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pass-on-attachments'
    AND public.auth_user_can_access_storage_path(name)
  );

DROP POLICY IF EXISTS tenant_pass_on_attachments_storage_insert ON storage.objects;
CREATE POLICY tenant_pass_on_attachments_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pass-on-attachments'
    AND public.auth_user_can_access_storage_path(name)
  );

DROP POLICY IF EXISTS tenant_pass_on_attachments_storage_delete ON storage.objects;
CREATE POLICY tenant_pass_on_attachments_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pass-on-attachments'
    AND public.auth_user_can_access_storage_path(name)
  );

COMMIT;

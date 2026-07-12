-- Migration 040: Platform admin RLS + properties ID sequence
-- Stage A — database-level protection for admin portal tables.
-- Apply after 037–039.

BEGIN;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helper (no RLS recursion on platform_admins)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auth_user_is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_admins pa
    WHERE pa.user_id = auth.uid()
      AND pa.active = true
  );
$$;

REVOKE ALL ON FUNCTION public.auth_user_is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_is_platform_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- properties_id_seq — new properties after current MAX(id); pilot id=1 preserved
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS properties_id_seq;

SELECT setval(
  'properties_id_seq',
  (SELECT COALESCE(MAX(id), 0) FROM properties),
  true
);

COMMENT ON SEQUENCE properties_id_seq IS
  'Allocates new property IDs. Initialized to MAX(properties.id); next nextval() returns MAX+1.';

-- ---------------------------------------------------------------------------
-- RLS: platform admin tables — SELECT for active platform admins only
-- No INSERT/UPDATE/DELETE policies for authenticated (service role via API)
-- ---------------------------------------------------------------------------

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_admins_select ON platform_admins
  FOR SELECT TO authenticated
  USING (public.auth_user_is_platform_admin());

ALTER TABLE organization_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_organization_modules_select ON organization_modules
  FOR SELECT TO authenticated
  USING (public.auth_user_is_platform_admin());

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_organization_invitations_select ON organization_invitations
  FOR SELECT TO authenticated
  USING (public.auth_user_is_platform_admin());

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_admin_audit_log_select ON admin_audit_log
  FOR SELECT TO authenticated
  USING (public.auth_user_is_platform_admin());

COMMIT;

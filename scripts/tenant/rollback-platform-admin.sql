-- Rollback script for platform admin portal migrations 037–040
-- Run ONLY if Stage A admin schema must be reversed.
-- Does NOT remove organizations, properties, or operational data created later.
-- Manually remove platform_admins rows before rollback if desired.

BEGIN;

-- ── 040: RLS + sequence ──
DROP POLICY IF EXISTS platform_admin_audit_log_select ON admin_audit_log;
DROP POLICY IF EXISTS platform_organization_invitations_select ON organization_invitations;
DROP POLICY IF EXISTS platform_organization_modules_select ON organization_modules;
DROP POLICY IF EXISTS platform_admins_select ON platform_admins;

ALTER TABLE admin_audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_modules DISABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins DISABLE ROW LEVEL SECURITY;

DROP SEQUENCE IF EXISTS properties_id_seq;

DROP FUNCTION IF EXISTS public.auth_user_is_platform_admin();

-- ── 039: audit log ──
DROP TABLE IF EXISTS admin_audit_log;

-- ── 038: modules + invitations ──
DROP FUNCTION IF EXISTS public.seed_default_organization_modules(INT);
DROP TABLE IF EXISTS organization_invitations;
DROP TABLE IF EXISTS organization_modules;

-- ── 037: platform admins ──
DROP TABLE IF EXISTS platform_admins;

COMMIT;

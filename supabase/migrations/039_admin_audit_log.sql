-- Migration 039: Platform admin audit log
-- Stage A — immutable action history for privileged operations.

BEGIN;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action          TEXT NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       TEXT NOT NULL,
  organization_id INT REFERENCES organizations(id) ON DELETE SET NULL,
  property_id     INT REFERENCES properties(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
  ON admin_audit_log (actor_user_id);

CREATE INDEX IF NOT EXISTS admin_audit_log_org_idx
  ON admin_audit_log (organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
  ON admin_audit_log (action);

COMMENT ON TABLE admin_audit_log IS
  'Audit trail for platform admin actions. Writes via service role only.';

COMMIT;

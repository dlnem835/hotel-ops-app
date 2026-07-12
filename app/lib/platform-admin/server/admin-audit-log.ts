import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAuditLogInput = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  organizationId?: number | null;
  propertyId?: number | null;
  metadata?: Record<string, unknown>;
};

export async function writeAdminAuditLog(
  supabase: SupabaseClient,
  input: AdminAuditLogInput
): Promise<void> {
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId,
    organization_id: input.organizationId ?? null,
    property_id: input.propertyId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

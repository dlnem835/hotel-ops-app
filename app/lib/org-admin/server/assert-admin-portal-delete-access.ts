import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrgAdminMembership } from "@/app/lib/org-admin/server/org-admin-entitlement";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";

/**
 * Destructive ops (Lost & Found delete, Pass On entry/reply delete) require
 * customer Admin Portal entitlement for the active organization — not hotel
 * staff roles, GM titles, or author match alone.
 */
export async function assertAdminPortalDeleteAccess(
  supabase: SupabaseClient,
  userId: string,
  organizationId: number
): Promise<void> {
  const membership = await resolveOrgAdminMembership(
    supabase,
    userId,
    organizationId
  );
  if (!membership) {
    throw new TenantRequestError(
      403,
      "Only Admin Portal users can delete this content."
    );
  }
}

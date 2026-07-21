import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { fetchAdminOrganizationDetail } from "@/app/lib/platform-admin/server/admin-organizations";
import { OrganizationAdminRequestError } from "@/app/lib/org-admin/server/resolve-organization-admin-request";
import { normalizeOrganizationOperationalProfile } from "@/app/lib/platform-admin/server/organization-profile-fields";
import type { AdminOrganizationDetail } from "@/app/lib/platform-admin/types";

/**
 * Organization profile update for the customer Organization Admin portal.
 *
 * Customers may edit the OPERATIONAL profile only — display name, contact email,
 * contact phone, business/mailing address, and an operational contact person.
 * Legal identity stays a One Eyrie concern and is never touched here:
 *   - legal_name : One Eyrie Platform Administration only
 *   - slug / id  : internal identifiers, preserved
 *   - status     : Suspend / Reactivate are protected platform actions
 *   - billing / subscription / licensing : not customer-editable
 *
 * Any legal-identity keys present in the body are ignored by construction: only
 * the operational allow-list from `normalizeOrganizationOperationalProfile` is
 * ever written.
 */
export async function updateOrganizationProfileAsOrgAdmin(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number,
  body: Record<string, unknown>
): Promise<AdminOrganizationDetail> {
  const normalized = normalizeOrganizationOperationalProfile(body, {
    requireName: true,
  });
  if (!normalized.ok) {
    throw new OrganizationAdminRequestError(normalized.status, normalized.message);
  }

  const { data: existing, error: loadError } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, status, contact_email, contact_phone, business_address, contact_name"
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!existing) {
    throw new OrganizationAdminRequestError(404, "Organization not found");
  }

  const patch = normalized.patch;
  const changedFields: string[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    const nextValue = patch[key] ?? null;
    const prevValue = (existing as Record<string, unknown>)[key] ?? null;
    if (nextValue !== prevValue) {
      changedFields.push(key);
      before[key] = prevValue;
      after[key] = nextValue;
    }
  }

  if (changedFields.length > 0) {
    const timestamp = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ ...patch, updated_at: timestamp })
      .eq("id", organizationId);

    if (updateError) {
      throw new OrganizationAdminRequestError(500, updateError.message);
    }

    await writeAdminAuditLog(supabase, {
      actorUserId,
      action: "organization.updated",
      targetType: "organization",
      targetId: String(organizationId),
      organizationId,
      propertyId: null,
      metadata: {
        actor: "organization_admin",
        scope: "operational_profile",
        changedFields,
        before,
        after,
        // Legal identity is never modified through the customer portal.
        legalIdentityUnchanged: {
          slug: existing.slug,
          status: existing.status,
        },
        note:
          "Customer Organization Admin updated the operational profile (legal identity preserved).",
      },
    });
  }

  const detail = await fetchAdminOrganizationDetail(supabase, organizationId);
  if (!detail) {
    throw new OrganizationAdminRequestError(404, "Organization not found");
  }
  return detail;
}

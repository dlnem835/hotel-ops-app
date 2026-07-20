import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import { fetchAdminOrganizationDetail } from "@/app/lib/platform-admin/server/admin-organizations";
import {
  ORGANIZATION_STATUS_ACTIVE,
  ORGANIZATION_STATUS_SUSPENDED,
} from "@/app/lib/platform-admin/server/organization-constants";
import type {
  AdminOrganizationDetail,
  PlatformAdminRecord,
} from "@/app/lib/platform-admin/types";

function slugifyOrganizationName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "organization";
}

export async function updateAdminOrganization(
  supabase: SupabaseClient,
  actorUserId: string,
  platformAdmin: PlatformAdminRecord,
  organizationId: number,
  body: Record<string, unknown>
): Promise<AdminOrganizationDetail> {
  if (platformAdmin.role !== "platform_owner") {
    throw new PlatformAdminRequestError(
      403,
      "Forbidden — platform owner access required"
    );
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    throw new PlatformAdminRequestError(400, "Organization name is required");
  }
  if (name.length > 120) {
    throw new PlatformAdminRequestError(400, "Organization name is too long");
  }

  const { data: existing, error: loadError } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", organizationId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!existing) {
    throw new PlatformAdminRequestError(404, "Organization not found");
  }

  // Keep existing slug unless name changed and slug still matches the old name.
  let nextSlug = String(existing.slug);
  if (name !== existing.name) {
    const candidate = slugifyOrganizationName(name);
    const { data: clash } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .neq("id", organizationId)
      .maybeSingle();
    nextSlug = clash ? `${candidate}-${organizationId}` : candidate;
  }

  const timestamp = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      name,
      slug: nextSlug,
      updated_at: timestamp,
    })
    .eq("id", organizationId);

  if (updateError) {
    throw new PlatformAdminRequestError(500, updateError.message);
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "organization.updated",
    targetType: "organization",
    targetId: String(organizationId),
    organizationId,
    propertyId: null,
    metadata: {
      fromName: existing.name,
      toName: name,
      fromSlug: existing.slug,
      toSlug: nextSlug,
      status: existing.status,
      note:
        existing.status === ORGANIZATION_STATUS_SUSPENDED
          ? "Organization remains suspended until reactivated."
          : existing.status === ORGANIZATION_STATUS_ACTIVE
            ? "Organization remains active."
            : `Organization status unchanged (${existing.status}).`,
    },
  });

  const detail = await fetchAdminOrganizationDetail(supabase, organizationId);
  if (!detail) {
    throw new PlatformAdminRequestError(404, "Organization not found");
  }
  return detail;
}

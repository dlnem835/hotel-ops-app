import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminOrganizationDetail } from "@/app/lib/platform-admin/types";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import {
  ensureUniqueOrganizationSlug,
  isValidOrganizationSlug,
  slugifyOrganizationName,
} from "@/app/lib/platform-admin/server/admin-slug";
import { fetchAdminOrganizationDetail } from "@/app/lib/platform-admin/server/admin-organizations";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";

export type CreateOrganizationInput = {
  name: string;
  slug?: string;
};

function parseCreateOrganizationInput(body: Record<string, unknown>): CreateOrganizationInput {
  const name = String(body.name ?? "").trim();
  const slug =
    body.slug === undefined || body.slug === null ? undefined : String(body.slug).trim();

  if (!name) {
    throw new PlatformAdminRequestError(400, "Organization name is required");
  }

  if (slug !== undefined) {
    if (!slug) {
      throw new PlatformAdminRequestError(400, "Organization slug cannot be empty");
    }
    if (!isValidOrganizationSlug(slug)) {
      throw new PlatformAdminRequestError(
        400,
        "Organization slug must use lowercase letters, numbers, and hyphens"
      );
    }
  }

  return { name, slug };
}

export async function createAdminOrganization(
  supabase: SupabaseClient,
  actorUserId: string,
  body: Record<string, unknown>
): Promise<AdminOrganizationDetail> {
  const input = parseCreateOrganizationInput(body);
  const baseSlug = input.slug ?? slugifyOrganizationName(input.name);

  if (input.slug) {
    const { data: existing, error: existingError } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", input.slug)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }
    if (existing) {
      throw new PlatformAdminRequestError(409, "Organization slug already exists");
    }
  }

  const slug = input.slug ?? (await ensureUniqueOrganizationSlug(supabase, baseSlug));

  const { data: organization, error: insertError } = await supabase
    .from("organizations")
    .insert({
      name: input.name,
      slug,
      status: "active",
    })
    .select("id, name, slug, status, created_at, updated_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new PlatformAdminRequestError(409, "Organization slug already exists");
    }
    throw new Error(insertError.message);
  }

  const organizationId = organization.id as number;

  const { error: seedError } = await supabase.rpc("seed_default_organization_modules", {
    p_organization_id: organizationId,
  });

  if (seedError) {
    await supabase.from("organizations").delete().eq("id", organizationId);
    throw new Error(seedError.message);
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "organization.created",
    targetType: "organization",
    targetId: String(organizationId),
    organizationId,
    metadata: {
      name: input.name,
      slug,
    },
  });

  const detail = await fetchAdminOrganizationDetail(supabase, organizationId);
  if (!detail) {
    throw new Error("Created organization could not be loaded");
  }

  return detail;
}

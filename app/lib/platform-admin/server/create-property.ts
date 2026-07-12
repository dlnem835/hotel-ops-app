import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminPropertyDetail } from "@/app/lib/platform-admin/types";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { fetchAdminPropertyDetail } from "@/app/lib/platform-admin/server/admin-organizations";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";

export type CreatePropertyInput = {
  name: string;
  brand?: string | null;
  address: string;
  phoneNumber?: string;
  timezone?: string;
};

function parseCreatePropertyInput(body: Record<string, unknown>): CreatePropertyInput {
  const name = String(body.name ?? "").trim();
  const address = String(body.address ?? "").trim();
  const brand =
    body.brand === undefined || body.brand === null
      ? null
      : String(body.brand).trim() || null;
  const phoneNumber = String(body.phoneNumber ?? body.phone_number ?? "").trim();
  const timezone = String(body.timezone ?? "America/New_York").trim() || "America/New_York";

  if (!name) {
    throw new PlatformAdminRequestError(400, "Property name is required");
  }

  return {
    name,
    brand,
    address,
    phoneNumber,
    timezone,
  };
}

async function allocateNextPropertyId(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("properties")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data?.id ?? 0) + 1;
}

export async function createAdminProperty(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number,
  body: Record<string, unknown>
): Promise<AdminPropertyDetail> {
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    throw new PlatformAdminRequestError(400, "Invalid organization id");
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgError) {
    throw new Error(orgError.message);
  }
  if (!organization) {
    throw new PlatformAdminRequestError(404, "Organization not found");
  }

  const input = parseCreatePropertyInput(body);

  let propertyId = await allocateNextPropertyId(supabase);
  let inserted = false;

  for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
    const { error: insertError } = await supabase.from("properties").insert({
      id: propertyId,
      organization_id: organizationId,
      name: input.name,
      brand: input.brand,
      address: input.address,
      phone_number: input.phoneNumber ?? "",
      timezone: input.timezone ?? "America/New_York",
      active: true,
    });

    if (!insertError) {
      inserted = true;
      break;
    }

    if (insertError.code === "23505") {
      propertyId = await allocateNextPropertyId(supabase);
      continue;
    }

    if (insertError.code === "23503") {
      throw new PlatformAdminRequestError(404, "Organization not found");
    }

    throw new Error(insertError.message);
  }

  if (!inserted) {
    throw new Error("Could not allocate a new property id");
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "property.created",
    targetType: "property",
    targetId: String(propertyId),
    organizationId,
    propertyId,
    metadata: {
      name: input.name,
      organizationName: organization.name,
    },
  });

  const detail = await fetchAdminPropertyDetail(supabase, propertyId);
  if (!detail) {
    throw new Error("Created property could not be loaded");
  }

  return detail;
}

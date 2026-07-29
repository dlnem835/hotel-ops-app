import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminPropertyDetail } from "@/app/lib/platform-admin/types";
import {
  addressValueToPropertyFields,
  propertyAddressToDbColumns,
} from "@/app/lib/address/property-address";
import type { AddressValue } from "@/app/lib/address/format";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { fetchAdminPropertyDetail } from "@/app/lib/platform-admin/server/admin-organizations";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import {
  DEFAULT_PROPERTY_TIMEZONE,
  isSupportedTimezone,
} from "@/app/lib/timezones";

export type CreatePropertyInput = {
  name: string;
  brand?: string | null;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostal: string;
  addressCountry: string;
  phoneNumber?: string;
  timezone: string;
};

function parseAddressFromBody(body: Record<string, unknown>): AddressValue {
  const nested =
    body.address && typeof body.address === "object"
      ? (body.address as Record<string, unknown>)
      : null;
  return {
    line1: String(
      body.addressLine1 ?? body.address_line1 ?? nested?.line1 ?? ""
    ).trim(),
    line2: String(
      body.addressLine2 ?? body.address_line2 ?? nested?.line2 ?? ""
    ).trim(),
    city: String(
      body.addressCity ?? body.address_city ?? nested?.city ?? ""
    ).trim(),
    state: String(
      body.addressState ?? body.address_state ?? nested?.state ?? ""
    ).trim(),
    postal: String(
      body.addressPostal ?? body.address_postal ?? nested?.postal ?? ""
    ).trim(),
    country:
      String(
        body.addressCountry ?? body.address_country ?? nested?.country ?? "US"
      ).trim() || "US",
  };
}

function parseCreatePropertyInput(body: Record<string, unknown>): CreatePropertyInput {
  const name = String(body.name ?? "").trim();
  const brand =
    body.brand === undefined || body.brand === null
      ? null
      : String(body.brand).trim() || null;
  const phoneNumber = String(body.phoneNumber ?? body.phone_number ?? "").trim();
  const timezone = String(body.timezone ?? "").trim();
  const address = parseAddressFromBody(body);

  if (!name) {
    throw new PlatformAdminRequestError(400, "Property name is required");
  }

  if (!timezone) {
    throw new PlatformAdminRequestError(400, "Timezone is required");
  }

  if (!isSupportedTimezone(timezone)) {
    throw new PlatformAdminRequestError(
      400,
      "Timezone must be a supported IANA identifier"
    );
  }

  return {
    name,
    brand,
    addressLine1: address.line1,
    addressLine2: address.line2,
    addressCity: address.city,
    addressState: address.state,
    addressPostal: address.postal,
    addressCountry: address.country,
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
  const addressColumns = propertyAddressToDbColumns(
    addressValueToPropertyFields({
      line1: input.addressLine1,
      line2: input.addressLine2,
      city: input.addressCity,
      state: input.addressState,
      postal: input.addressPostal,
      country: input.addressCountry,
    })
  );

  let propertyId = await allocateNextPropertyId(supabase);
  let inserted = false;

  for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
    const { error: insertError } = await supabase.from("properties").insert({
      id: propertyId,
      organization_id: organizationId,
      name: input.name,
      brand: input.brand,
      phone_number: input.phoneNumber ?? "",
      timezone: input.timezone || DEFAULT_PROPERTY_TIMEZONE,
      active: true,
      ...addressColumns,
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
      timezone: input.timezone,
    },
  });

  const detail = await fetchAdminPropertyDetail(supabase, propertyId);
  if (!detail) {
    throw new Error("Created property could not be loaded");
  }

  return detail;
}

export async function updateAdminPropertyAddress(
  supabase: SupabaseClient,
  actorUserId: string,
  propertyId: number,
  body: Record<string, unknown>
): Promise<AdminPropertyDetail> {
  const address = parseAddressFromBody(body);
  const addressColumns = propertyAddressToDbColumns(
    addressValueToPropertyFields(address)
  );

  const { data: existing, error: existingError } = await supabase
    .from("properties")
    .select("id, organization_id, name")
    .eq("id", propertyId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (!existing) {
    throw new PlatformAdminRequestError(404, "Property not found");
  }

  const { error } = await supabase
    .from("properties")
    .update({
      ...addressColumns,
      updated_at: new Date().toISOString(),
    })
    .eq("id", propertyId);

  if (error) throw new Error(error.message);

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "property.address_updated",
    targetType: "property",
    targetId: String(propertyId),
    organizationId: Number(existing.organization_id),
    propertyId,
    metadata: { name: existing.name },
  });

  const detail = await fetchAdminPropertyDetail(supabase, propertyId);
  if (!detail) throw new Error("Updated property could not be loaded");
  return detail;
}

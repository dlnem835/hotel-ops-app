import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { HotelProperty, HotelPropertyInput } from "./hotel-property-types";

export type PropertyTenantScope = {
  organizationId: number;
  propertyId: number;
};

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function toHotelProperty(row: Record<string, unknown>): HotelProperty {
  return {
    hotelName: String(row.name ?? row.hotel_name ?? ""),
    address: String(row.address || ""),
    phoneNumber: String(row.phone_number || ""),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export async function fetchHotelProperty(
  supabase: SupabaseClient,
  scope: PropertyTenantScope
): Promise<HotelProperty> {
  const { data, error } = await supabase
    .from("properties")
    .select("name, address, phone_number, updated_at")
    .eq("id", scope.propertyId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (error || !data) {
    return {
      hotelName: "",
      address: "",
      phoneNumber: "",
      updatedAt: null,
    };
  }

  return toHotelProperty(data);
}

export async function updateHotelProperty(
  supabase: SupabaseClient,
  scope: PropertyTenantScope,
  input: HotelPropertyInput
): Promise<HotelProperty> {
  const { data, error } = await supabase
    .from("properties")
    .update({
      name: input.hotelName,
      address: input.address,
      phone_number: input.phoneNumber,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scope.propertyId)
    .eq("organization_id", scope.organizationId)
    .select("name, address, phone_number, updated_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toHotelProperty(data);
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  getPropertyAddressIncompleteFields,
  isPropertyAddressComplete,
  propertyAddressToDbColumns,
  propertyRowToAddressFields,
} from "@/app/lib/address/property-address";
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

const PROPERTY_ADDRESS_SELECT =
  "name, address, address_line1, address_line2, address_city, address_state, address_postal, address_country, phone_number, updated_at";

export function toHotelProperty(row: Record<string, unknown>): HotelProperty {
  const fields = propertyRowToAddressFields(row);
  const incomplete = getPropertyAddressIncompleteFields(fields);
  return {
    hotelName: String(row.name ?? row.hotel_name ?? ""),
    address: String(row.address || ""),
    addressLine1: fields.addressLine1,
    addressLine2: fields.addressLine2,
    addressCity: fields.addressCity,
    addressState: fields.addressState,
    addressPostal: fields.addressPostal,
    addressCountry: fields.addressCountry,
    phoneNumber: String(row.phone_number || ""),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    addressComplete: isPropertyAddressComplete(fields),
    addressIncompleteFields: incomplete,
  };
}

export async function fetchHotelProperty(
  supabase: SupabaseClient,
  scope: PropertyTenantScope
): Promise<HotelProperty> {
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_ADDRESS_SELECT)
    .eq("id", scope.propertyId)
    .eq("organization_id", scope.organizationId)
    .maybeSingle();

  if (error || !data) {
    return {
      hotelName: "",
      address: "",
      addressLine1: "",
      addressLine2: "",
      addressCity: "",
      addressState: "",
      addressPostal: "",
      addressCountry: "US",
      phoneNumber: "",
      updatedAt: null,
      addressComplete: false,
      addressIncompleteFields: getPropertyAddressIncompleteFields({
        addressLine1: "",
        addressLine2: "",
        addressCity: "",
        addressState: "",
        addressPostal: "",
        addressCountry: "US",
      }),
    };
  }

  return toHotelProperty(data as Record<string, unknown>);
}

export async function updateHotelProperty(
  supabase: SupabaseClient,
  scope: PropertyTenantScope,
  input: HotelPropertyInput
): Promise<HotelProperty> {
  const columns = propertyAddressToDbColumns({
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    addressCity: input.addressCity,
    addressState: input.addressState,
    addressPostal: input.addressPostal,
    addressCountry: input.addressCountry,
  });

  const { data, error } = await supabase
    .from("properties")
    .update({
      name: input.hotelName,
      phone_number: input.phoneNumber,
      ...columns,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scope.propertyId)
    .eq("organization_id", scope.organizationId)
    .select(PROPERTY_ADDRESS_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toHotelProperty(data as Record<string, unknown>);
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { HotelProperty } from "./hotel-property-types";

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function toHotelProperty(row: Record<string, unknown>): HotelProperty {
  return {
    hotelName: String(row.hotel_name || ""),
    address: String(row.address || ""),
    phoneNumber: String(row.phone_number || ""),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export async function fetchHotelProperty(
  supabase: SupabaseClient
): Promise<HotelProperty> {
  const { data, error } = await supabase
    .from("hotel_property")
    .select("hotel_name, address, phone_number, updated_at")
    .eq("id", 1)
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

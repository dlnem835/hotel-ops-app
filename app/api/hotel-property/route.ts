import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  HotelPropertyInput,
} from "@/app/settings/lib/hotel-property-types";
import {
  fetchHotelProperty,
  getSupabaseAdmin,
  toHotelProperty,
} from "@/app/settings/lib/hotel-property-db";

function normalizeInput(body: Record<string, unknown>): HotelPropertyInput {
  return {
    hotelName: String(body.hotelName ?? body.hotel_name ?? "").trim(),
    address: String(body.address ?? "").trim(),
    phoneNumber: String(body.phoneNumber ?? body.phone_number ?? "").trim(),
  };
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const property = await fetchHotelProperty(supabaseAdmin);
    return NextResponse.json({ property });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const input = normalizeInput(body);

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("hotel_property")
      .upsert(
        {
          id: 1,
          hotel_name: input.hotelName,
          address: input.address,
          phone_number: input.phoneNumber,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("hotel_name, address, phone_number, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ property: toHotelProperty(data) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

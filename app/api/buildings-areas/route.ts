import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getNameKey } from "@/app/settings/lib/buildings-areas";
import { AreaType } from "@/app/settings/lib/buildings-types";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function normalizeRecord(record: Record<string, unknown>) {
  const name = String(record.name || "").trim();
  const areaType = String(record.area_type || "").trim() as AreaType;
  const isGuestRoom = areaType === "Guest Room";
  const normalizedName = isGuestRoom
    ? name.replace(/^room\s+/i, "")
    : name;

  return {
    name: normalizedName,
    area_type: areaType,
    floor_location: String(record.floor_location || "").trim(),
    status: String(record.status || "Active").trim(),
    inspection_enabled:
      record.inspection_enabled === undefined
        ? true
        : Boolean(record.inspection_enabled),
    nameKey: getNameKey(normalizedName, areaType),
  };
}

async function getExistingNameKeys(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  excludeId?: number
) {
  let query = supabaseAdmin.from("buildings_and_areas").select("id, name, area_type");

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    (data || []).map((row) =>
      getNameKey(String(row.name), row.area_type as AreaType)
    )
  );
}

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("buildings_and_areas")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ areas: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const record = normalizeRecord(body);

    if (!record.name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const existingNames = await getExistingNameKeys(supabaseAdmin);
    const { nameKey, ...recordToInsert } = record;

    if (existingNames.has(nameKey)) {
      return NextResponse.json(
        {
          error: "This location already exists.",
          duplicate: true,
          skipped: 1,
          created: 0,
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("buildings_and_areas")
      .insert([recordToInsert])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ area: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...rest } = body;

    if (!id) {
      return NextResponse.json({ error: "Id is required" }, { status: 400 });
    }

    const record = normalizeRecord(rest);
    const supabaseAdmin = getSupabaseAdmin();

    const existingNames = await getExistingNameKeys(supabaseAdmin, Number(id));
    const { nameKey, ...recordToUpdate } = record;

    if (existingNames.has(nameKey)) {
      return NextResponse.json(
        {
          error: "Another location with this name already exists.",
          duplicate: true,
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("buildings_and_areas")
      .update(recordToUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ area: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Id is required" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from("buildings_and_areas")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

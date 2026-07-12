import { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  generateRoomRecords,
  getNameKey,
  partitionNewRecords,
  STANDARD_HOTEL_AREAS,
} from "@/app/settings/lib/buildings-areas";
import { AreaType, BuildingAreaInput } from "@/app/settings/lib/buildings-types";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type TenantScope = { organizationId: number; propertyId: number };

function normalizeRecord(record: BuildingAreaInput) {
  const isGuestRoom = record.area_type === "Guest Room";
  const name = isGuestRoom
    ? String(record.name).trim().replace(/^room\s+/i, "")
    : String(record.name).trim();

  return {
    name,
    area_type: record.area_type,
    floor_location: record.floor_location || "",
    status: record.status || "Active",
    inspection_enabled:
      record.inspection_enabled === undefined ? true : record.inspection_enabled,
  };
}

async function getExistingNames(supabaseAdmin: SupabaseClient, scope: TenantScope) {
  const { data, error } = await supabaseAdmin
    .from("buildings_and_areas")
    .select("name, area_type")
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);

  if (error) {
    throw new Error(error.message);
  }

  return new Set(
    (data || []).map((row) =>
      getNameKey(String(row.name), row.area_type as AreaType)
    )
  );
}

async function insertRecords(
  supabaseAdmin: SupabaseClient,
  records: BuildingAreaInput[],
  scope: TenantScope
) {
  const existingNames = await getExistingNames(supabaseAdmin, scope);
  const { toInsert, skipped } = partitionNewRecords(records, existingNames);
  const newRecords = toInsert.map((record) => ({
    ...normalizeRecord(record),
    organization_id: scope.organizationId,
    property_id: scope.propertyId,
  }));

  if (newRecords.length === 0) {
    return { created: 0, skipped, areas: [], addedNames: [] as string[] };
  }

  const { data, error } = await supabaseAdmin
    .from("buildings_and_areas")
    .insert(newRecords)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return {
    created: data?.length || 0,
    skipped,
    areas: data || [],
    addedNames: toInsert.map((record) => record.name),
  };
}

export async function POST(request: Request) {
  try {
    const { supabase: supabaseAdmin, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const scope = { organizationId, propertyId };
    const body = await request.json();
    const { action } = body;

    if (action === "generate") {
      const records = generateRoomRecords({
        startRoom: Number(body.startRoom),
        endRoom: Number(body.endRoom),
        floor: String(body.floor || ""),
        areaType: body.areaType || "Guest Room",
        skipRooms: body.skipRooms,
      });

      if (records.length === 0) {
        return NextResponse.json(
          { error: "No rooms to generate. Check your range and skip list." },
          { status: 400 }
        );
      }

      const result = await insertRecords(supabaseAdmin, records, scope);
      return NextResponse.json({ ...result, action: "generate" });
    }

    if (action === "standard") {
      const result = await insertRecords(supabaseAdmin, STANDARD_HOTEL_AREAS, scope);
      return NextResponse.json({ ...result, action: "standard" });
    }

    if (action === "import") {
      const records = (body.records || []) as BuildingAreaInput[];

      if (!records.length) {
        return NextResponse.json(
          { error: "No records provided for import." },
          { status: 400 }
        );
      }

      const result = await insertRecords(supabaseAdmin, records, scope);
      return NextResponse.json({ ...result, action: "import" });
    }

    if (action === "wizard") {
      const roomRanges = (body.roomRanges || []) as Array<{
        startRoom: number | string;
        endRoom: number | string;
        floor: string;
        areaType: AreaType;
        skipRooms?: string;
      }>;

      const roomRecords = roomRanges.flatMap((range) => {
        const startRoom = Number(range.startRoom);
        const endRoom = Number(range.endRoom);

        if (
          Number.isNaN(startRoom) ||
          Number.isNaN(endRoom) ||
          range.startRoom === "" ||
          range.endRoom === ""
        ) {
          return [];
        }

        return generateRoomRecords({
          startRoom,
          endRoom,
          floor: String(range.floor || ""),
          areaType: range.areaType || "Guest Room",
          skipRooms: range.skipRooms,
        });
      });

      // Legacy single-range support
      if (roomRecords.length === 0 && body.startRoom !== undefined) {
        const startRoom = Number(body.startRoom);
        const endRoom = Number(body.endRoom);
        const hasRoomRange =
          !Number.isNaN(startRoom) &&
          !Number.isNaN(endRoom) &&
          body.startRoom !== "" &&
          body.endRoom !== "";

        if (hasRoomRange) {
          roomRecords.push(
            ...generateRoomRecords({
              startRoom,
              endRoom,
              floor: String(body.floor || ""),
              areaType: body.areaType || "Guest Room",
              skipRooms: body.skipRooms,
            })
          );
        }
      }

      const importRecords = (body.importRecords || []) as BuildingAreaInput[];

      const allRecords = [
        ...roomRecords,
        ...(body.addStandardAreas ? STANDARD_HOTEL_AREAS : []),
        ...importRecords,
      ];

      if (allRecords.length === 0) {
        return NextResponse.json(
          {
            error:
              "Nothing to create. Add a room range, enable standard areas, or import a CSV file.",
          },
          { status: 400 }
        );
      }

      const result = await insertRecords(supabaseAdmin, allRecords, scope);
      return NextResponse.json({ ...result, action: "wizard" });
    }

    if (action === "bulk-delete") {
      const ids = (body.ids || []) as number[];

      if (!ids.length) {
        return NextResponse.json(
          { error: "No locations selected for deletion." },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin
        .from("buildings_and_areas")
        .delete()
        .in("id", ids)
        .eq("organization_id", organizationId)
        .eq("property_id", propertyId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ deleted: ids.length, action: "bulk-delete" });
    }

    if (action === "bulk-status") {
      const ids = (body.ids || []) as number[];
      const status = String(body.status || "").trim();

      const validStatuses = ["Active", "Out of Service", "Inactive"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }

      if (!ids.length) {
        return NextResponse.json(
          { error: "No locations selected for update." },
          { status: 400 }
        );
      }

      const { error } = await supabaseAdmin
        .from("buildings_and_areas")
        .update({ status })
        .in("id", ids)
        .eq("organization_id", organizationId)
        .eq("property_id", propertyId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ updated: ids.length, action: "bulk-status" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import { fetchRoomHistory, getSupabaseAdmin } from "@/app/inspections/lib/inspection-db";

type RouteContext = { params: Promise<{ areaId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { areaId } = await context.params;
    const supabase = getSupabaseAdmin();
    const result = await fetchRoomHistory(supabase, Number(areaId));
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

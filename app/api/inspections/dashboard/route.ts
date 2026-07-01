import { NextResponse } from "next/server";
import { buildDashboard, getSupabaseAdmin } from "@/app/inspections/lib/inspection-db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const program = searchParams.get("program");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const supabase = getSupabaseAdmin();
    const payload = await buildDashboard(supabase, period, program, month, year);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

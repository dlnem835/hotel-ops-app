import { NextResponse } from "next/server";
import { buildMaintenanceDashboard } from "@/app/maintenance/lib/maintenance-dashboard";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const payload = await buildMaintenanceDashboard(supabase);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

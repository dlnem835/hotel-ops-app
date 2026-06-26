import { NextResponse } from "next/server";
import { buildOperationalDashboard } from "@/app/dashboard/lib/operational-dashboard";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const payload = await buildOperationalDashboard(supabase);
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

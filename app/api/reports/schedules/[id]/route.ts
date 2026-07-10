import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";
import { deleteScheduledReportSchedule } from "@/app/reports/lib/report-schedule-db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    await deleteScheduledReportSchedule(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete schedule.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";
import { processScheduledReportRow } from "@/app/reports/lib/scheduled-report-processor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const { data: dbRow, error } = await supabase
      .from("scheduled_report_schedules")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !dbRow) {
      return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    }

    const result = await processScheduledReportRow(supabase, dbRow, {
      triggeredBy: "test",
      updateNextRun: false,
    });

    if (result.status === "failed") {
      return NextResponse.json(
        { ok: false, error: result.error, result },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send test failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

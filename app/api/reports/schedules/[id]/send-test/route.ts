import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";
import {
  getScheduledReportSafeError,
  processScheduledReportRow,
  SCHEDULED_REPORT_SAFE_ERRORS,
} from "@/app/reports/lib/scheduled-report-processor";

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
      return NextResponse.json(
        { ok: false, error: SCHEDULED_REPORT_SAFE_ERRORS.databaseQueryFailed },
        { status: 404 }
      );
    }

    const result = await processScheduledReportRow(supabase, dbRow, {
      triggeredBy: "test",
      updateNextRun: false,
    });

    if (result.status === "failed") {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      result: {
        scheduleId: result.scheduleId,
        status: result.status,
        resendMessageId: result.resendMessageId,
        testSentAt: result.testSentAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getScheduledReportSafeError(error) },
      { status: 500 }
    );
  }
}

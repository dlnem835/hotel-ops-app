import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";
import {
  claimDueScheduledReportSchedules,
  type ScheduledReportScheduleRow,
} from "@/app/reports/lib/report-schedule-db";
import { processScheduledReportRow } from "@/app/reports/lib/scheduled-report-processor";

function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    console.warn("[scheduled-reports] unauthorized cron invocation");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  console.info("[scheduled-reports] cron endpoint invoked", { at: nowIso });

  try {
    const supabase = getSupabaseAdmin();
    const dueRows = await claimDueScheduledReportSchedules(supabase, nowIso);
    console.info("[scheduled-reports] due schedules found", { count: dueRows.length });

    const results = [];
    for (const row of dueRows) {
      const result = await processScheduledReportRow(supabase, row as ScheduledReportScheduleRow, {
        triggeredBy: "cron",
        claimToken: row.processing_claim_token || undefined,
        updateNextRun: true,
      });
      results.push(result);
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      sent: results.filter((item) => item.status === "sent").length,
      failed: results.filter((item) => item.status === "failed").length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled report cron failed.";
    console.error("[scheduled-reports] cron failure", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

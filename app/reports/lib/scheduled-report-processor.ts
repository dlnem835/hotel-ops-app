import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildReportPdfBuffer } from "@/app/reports/lib/generate-report-pdf";
import { buildReportPdfFilename } from "@/app/reports/lib/report-output-utils";
import {
  computeFollowingRunAtUtc,
  type ScheduleTimingInput,
} from "@/app/reports/lib/report-schedule-next-run";
import {
  insertScheduledReportRun,
  scheduleRowToContext,
  scheduleRowToTiming,
  type ScheduledReportScheduleRow,
  updateScheduleAfterRun,
} from "@/app/reports/lib/report-schedule-db";
import {
  buildScheduledReportEmailHtml,
  parseScheduleRecipients,
} from "@/app/reports/lib/scheduled-report-email";
import { generateScheduledReportPayload } from "@/app/reports/lib/scheduled-report-generate";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export type ProcessScheduleResult = {
  scheduleId: string;
  status: "sent" | "failed";
  resendMessageId: string | null;
  error: string | null;
};

export async function processScheduledReportRow(
  supabase: SupabaseClient,
  row: ScheduledReportScheduleRow,
  options: {
    triggeredBy: "cron" | "test";
    claimToken?: string;
    updateNextRun: boolean;
  }
): Promise<ProcessScheduleResult> {
  const runAt = new Date();
  const claimToken = options.claimToken || row.processing_claim_token || "";
  const recipients = parseScheduleRecipients(row.recipients);

  if (recipients.length === 0) {
    const error = "No valid recipient email addresses are configured for this schedule.";
    await finalizeScheduleRun(supabase, row, {
      claimToken,
      triggeredBy: options.triggeredBy,
      runAt,
      status: "failed",
      error,
      resendMessageId: null,
      updateNextRun: options.updateNextRun,
    });
    return { scheduleId: row.id, status: "failed", resendMessageId: null, error };
  }

  try {
    const context = scheduleRowToContext(row);
    console.info("[scheduled-reports] generating report", {
      scheduleId: row.id,
      reportModule: context.reportModule,
      reportId: context.reportId,
    });

    const payload = await generateScheduledReportPayload(context, runAt);
    const pdfBuffer = buildReportPdfBuffer({
      reportName: payload.reportName,
      propertyName: payload.propertyName,
      dateRangeLabel: payload.dateRangeLabel,
      filterLines: payload.filterLines,
      tables: payload.tables,
      generatedAtLabel: payload.generatedAtLabel,
    });

    console.info("[scheduled-reports] pdf generated", {
      scheduleId: row.id,
      tableCount: payload.tables.length,
      bytes: pdfBuffer.length,
    });

    if (!resend) {
      throw new Error("RESEND_API_KEY is not configured.");
    }

    const html = buildScheduledReportEmailHtml({
      reportName: payload.reportName,
      propertyName: payload.propertyName,
      dateRangeLabel: payload.dateRangeLabel,
      generatedAtLabel: payload.generatedAtLabel,
      filterLines: payload.filterLines,
    });

    const result = await resend.emails.send({
      from: "Front Desk One Eyrie <support@oneeyrie.com>",
      to: recipients,
      subject: `Scheduled Report: ${payload.reportName}`,
      html,
      attachments: [
        {
          filename: buildReportPdfFilename(payload.reportName),
          content: pdfBuffer,
        },
      ],
    });

    if (result.error) {
      throw new Error(result.error.message || "Resend rejected the scheduled report email.");
    }

    const resendMessageId = result.data?.id ?? null;
    console.info("[scheduled-reports] email sent", {
      scheduleId: row.id,
      resendMessageId,
      recipientCount: recipients.length,
    });

    await finalizeScheduleRun(supabase, row, {
      claimToken,
      triggeredBy: options.triggeredBy,
      runAt,
      status: "sent",
      error: null,
      resendMessageId,
      updateNextRun: options.updateNextRun,
    });

    return { scheduleId: row.id, status: "sent", resendMessageId, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled report delivery failed.";
    console.error("[scheduled-reports] send failure", {
      scheduleId: row.id,
      error: message,
    });

    await finalizeScheduleRun(supabase, row, {
      claimToken,
      triggeredBy: options.triggeredBy,
      runAt,
      status: "failed",
      error: message,
      resendMessageId: null,
      updateNextRun: options.updateNextRun,
    });

    return { scheduleId: row.id, status: "failed", resendMessageId: null, error: message };
  }
}

async function finalizeScheduleRun(
  supabase: SupabaseClient,
  row: ScheduledReportScheduleRow,
  input: {
    claimToken: string;
    triggeredBy: "cron" | "test";
    runAt: Date;
    status: "sent" | "failed";
    error: string | null;
    resendMessageId: string | null;
    updateNextRun: boolean;
  }
) {
  const runAtIso = input.runAt.toISOString();
  const timing = scheduleRowToTiming(row) as ScheduleTimingInput;
  let nextRunAt: string | null = row.next_run_at;
  let active = row.active;

  if (input.updateNextRun) {
    nextRunAt = computeFollowingRunAtUtc(timing, input.runAt);
    if (!nextRunAt) {
      active = false;
    }
    console.info("[scheduled-reports] next run calculated", {
      scheduleId: row.id,
      nextRunAt,
      active,
    });
  }

  if (input.claimToken) {
    await updateScheduleAfterRun(supabase, {
      scheduleId: row.id,
      claimToken: input.claimToken,
      lastRunAt: runAtIso,
      lastStatus: input.status,
      lastError: input.error,
      nextRunAt: input.updateNextRun ? nextRunAt : row.next_run_at,
      active: input.updateNextRun ? active : row.active,
    });
  } else {
    await supabase
      .from("scheduled_report_schedules")
      .update({
        last_run_at: runAtIso,
        last_status: input.status,
        last_error: input.error,
        ...(input.updateNextRun
          ? { next_run_at: nextRunAt, active }
          : {}),
        updated_at: runAtIso,
      })
      .eq("id", row.id);
  }

  await insertScheduledReportRun(supabase, {
    scheduleId: row.id,
    triggeredBy: input.triggeredBy,
    status: input.status,
    error: input.error,
    resendMessageId: input.resendMessageId,
  });
}

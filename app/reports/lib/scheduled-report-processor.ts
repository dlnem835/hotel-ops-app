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

export const SCHEDULED_REPORT_SAFE_ERRORS = {
  missingRecipient: "Missing recipient",
  reportGenerationFailed: "Report generation failed",
  pdfGenerationFailed: "PDF generation failed",
  resendFailed: "Resend failed",
  missingEnvironmentVariable: "Missing environment variable",
  databaseQueryFailed: "Database query failed",
} as const;

export type ScheduledReportSafeError =
  (typeof SCHEDULED_REPORT_SAFE_ERRORS)[keyof typeof SCHEDULED_REPORT_SAFE_ERRORS];

class ScheduledReportDeliveryError extends Error {
  constructor(public readonly safeMessage: ScheduledReportSafeError) {
    super(safeMessage);
    this.name = "ScheduledReportDeliveryError";
  }
}

export type ProcessScheduleResult = {
  scheduleId: string;
  status: "sent" | "failed";
  resendMessageId: string | null;
  error: string | null;
  testSentAt: string | null;
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
    const error = SCHEDULED_REPORT_SAFE_ERRORS.missingRecipient;
    await recordScheduleRunSafely(supabase, row, {
      claimToken,
      triggeredBy: options.triggeredBy,
      runAt,
      status: "failed",
      error,
      resendMessageId: null,
      updateNextRun: options.updateNextRun,
    });
    return {
      scheduleId: row.id,
      status: "failed",
      resendMessageId: null,
      error,
      testSentAt: null,
    };
  }

  const context = scheduleRowToContext(row);
  console.info("[scheduled-reports] generating report", {
    scheduleId: row.id,
    reportModule: context.reportModule,
    reportId: context.reportId,
    triggeredBy: options.triggeredBy,
  });

  let payload;
  try {
    payload = await generateScheduledReportPayload(context, runAt);
  } catch (error) {
    const message = logAndMapDeliveryError(row.id, error, "report");
    await recordScheduleRunSafely(supabase, row, {
      claimToken,
      triggeredBy: options.triggeredBy,
      runAt,
      status: "failed",
      error: message,
      resendMessageId: null,
      updateNextRun: options.updateNextRun,
    });
    return {
      scheduleId: row.id,
      status: "failed",
      resendMessageId: null,
      error: message,
      testSentAt: null,
    };
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = buildReportPdfBuffer({
      reportName: payload.reportName,
      propertyName: payload.propertyName,
      dateRangeLabel: payload.dateRangeLabel,
      filterLines: payload.filterLines,
      tables: payload.tables,
      generatedAtLabel: payload.generatedAtLabel,
    });
  } catch (error) {
    const message = logAndMapDeliveryError(row.id, error, "pdf");
    await recordScheduleRunSafely(supabase, row, {
      claimToken,
      triggeredBy: options.triggeredBy,
      runAt,
      status: "failed",
      error: message,
      resendMessageId: null,
      updateNextRun: options.updateNextRun,
    });
    return {
      scheduleId: row.id,
      status: "failed",
      resendMessageId: null,
      error: message,
      testSentAt: null,
    };
  }

  console.info("[scheduled-reports] pdf generated", {
    scheduleId: row.id,
    tableCount: payload.tables.length,
    bytes: pdfBuffer.length,
  });

  if (!resend) {
    const error = SCHEDULED_REPORT_SAFE_ERRORS.missingEnvironmentVariable;
    await recordScheduleRunSafely(supabase, row, {
      claimToken,
      triggeredBy: options.triggeredBy,
      runAt,
      status: "failed",
      error,
      resendMessageId: null,
      updateNextRun: options.updateNextRun,
    });
    return {
      scheduleId: row.id,
      status: "failed",
      resendMessageId: null,
      error,
      testSentAt: null,
    };
  }

  try {
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
      throw new ScheduledReportDeliveryError(SCHEDULED_REPORT_SAFE_ERRORS.resendFailed);
    }

    const resendMessageId = result.data?.id ?? null;
    const testSentAt = runAt.toISOString();
    console.info("[scheduled-reports] email sent", {
      scheduleId: row.id,
      resendMessageId,
      recipientCount: recipients.length,
      triggeredBy: options.triggeredBy,
    });

    try {
      await finalizeScheduleRun(supabase, row, {
        claimToken,
        triggeredBy: options.triggeredBy,
        runAt,
        status: "sent",
        error: null,
        resendMessageId,
        updateNextRun: options.updateNextRun,
      });
    } catch (error) {
      const message = getScheduledReportSafeError(error);
      return {
        scheduleId: row.id,
        status: "failed",
        resendMessageId,
        error: message,
        testSentAt: null,
      };
    }

    return {
      scheduleId: row.id,
      status: "sent",
      resendMessageId,
      error: null,
      testSentAt: options.triggeredBy === "test" ? testSentAt : null,
    };
  } catch (error) {
    const message = logAndMapDeliveryError(row.id, error, "resend");

    await recordScheduleRunSafely(supabase, row, {
      claimToken,
      triggeredBy: options.triggeredBy,
      runAt,
      status: "failed",
      error: message,
      resendMessageId: null,
      updateNextRun: options.updateNextRun,
    });

    return {
      scheduleId: row.id,
      status: "failed",
      resendMessageId: null,
      error: message,
      testSentAt: null,
    };
  }
}

function logAndMapDeliveryError(
  scheduleId: string,
  error: unknown,
  stage: "report" | "pdf" | "resend"
): ScheduledReportSafeError {
  const detail = error instanceof Error ? error.message : String(error);
  console.error("[scheduled-reports] send failure", {
    scheduleId,
    stage,
    error: detail,
  });

  if (error instanceof ScheduledReportDeliveryError) {
    return error.safeMessage;
  }

  if (stage === "report") {
    return SCHEDULED_REPORT_SAFE_ERRORS.reportGenerationFailed;
  }
  if (stage === "pdf") {
    return SCHEDULED_REPORT_SAFE_ERRORS.pdfGenerationFailed;
  }
  return SCHEDULED_REPORT_SAFE_ERRORS.resendFailed;
}

export function getScheduledReportSafeError(error: unknown): ScheduledReportSafeError {
  if (error instanceof ScheduledReportDeliveryError) {
    return error.safeMessage;
  }

  if (error instanceof Error) {
    const safeValues = Object.values(SCHEDULED_REPORT_SAFE_ERRORS);
    if (safeValues.includes(error.message as ScheduledReportSafeError)) {
      return error.message as ScheduledReportSafeError;
    }
  }

  return SCHEDULED_REPORT_SAFE_ERRORS.databaseQueryFailed;
}

async function recordScheduleRunSafely(
  supabase: SupabaseClient,
  row: ScheduledReportScheduleRow,
  input: Parameters<typeof finalizeScheduleRun>[2]
) {
  try {
    await finalizeScheduleRun(supabase, row, input);
  } catch (error) {
    console.error("[scheduled-reports] finalize failed", {
      scheduleId: row.id,
      error: error instanceof Error ? error.message : String(error),
    });
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
  const isTestOnlyRun = input.triggeredBy === "test" && !input.updateNextRun;

  if (!isTestOnlyRun) {
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
      const { error } = await supabase
        .from("scheduled_report_schedules")
        .update({
          last_run_at: runAtIso,
          last_status: input.status,
          last_error: input.error,
          ...(input.updateNextRun ? { next_run_at: nextRunAt, active } : {}),
          updated_at: runAtIso,
        })
        .eq("id", row.id);

      if (error) {
        throw new ScheduledReportDeliveryError(SCHEDULED_REPORT_SAFE_ERRORS.databaseQueryFailed);
      }
    }
  }

  try {
    await insertScheduledReportRun(supabase, {
      scheduleId: row.id,
      triggeredBy: input.triggeredBy,
      status: input.status,
      error: input.error,
      resendMessageId: input.resendMessageId,
    });
  } catch (error) {
    console.error("[scheduled-reports] run history insert failed", {
      scheduleId: row.id,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ScheduledReportDeliveryError(SCHEDULED_REPORT_SAFE_ERRORS.databaseQueryFailed);
  }
}

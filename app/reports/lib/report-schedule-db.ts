import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReportScheduleContext,
  ReportScheduleFormValues,
  SavedReportSchedule,
} from "@/app/reports/lib/report-schedule-types";

export type ScheduledReportScheduleRow = {
  id: string;
  property_id: number;
  created_by: string | null;
  report_module: string;
  report_id: string;
  report_name: string;
  property_name: string;
  date_range_label: string;
  date_preset: string;
  date_start: string;
  date_end: string;
  filter_lines: string[];
  filter_snapshot: Record<string, unknown>;
  inspection_variant: string | null;
  recipients: string;
  frequency: string;
  repeat_every: number;
  interval_unit: string;
  weekly_day: string | null;
  monthly_day: number | null;
  schedule_time: string;
  timezone: string;
  start_date: string;
  end_date: string | null;
  active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  processing_claimed_at: string | null;
  processing_claim_token: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateScheduledReportInput = {
  createdBy: string | null;
  schedule: ReportScheduleFormValues;
  context: ReportScheduleContext;
  timezone: string;
  nextRunAt: string;
};

export type SavedReportScheduleWithMeta = SavedReportSchedule & {
  timezone: string;
  nextRunAt: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
};

function rowToSavedSchedule(row: ScheduledReportScheduleRow): SavedReportScheduleWithMeta {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schedule: {
      reportName: row.report_name,
      property: row.property_name,
      recipients: row.recipients,
      frequency: row.frequency as ReportScheduleFormValues["frequency"],
      repeatEvery: row.repeat_every,
      intervalUnit: row.interval_unit as ReportScheduleFormValues["intervalUnit"],
      weeklyDay: (row.weekly_day || "Monday") as ReportScheduleFormValues["weeklyDay"],
      monthlyDay: row.monthly_day || 1,
      time: row.schedule_time,
      startDate: row.start_date,
      endDate: row.end_date || "",
      active: row.active,
    },
    context: {
      reportModule: row.report_module as ReportScheduleContext["reportModule"],
      reportId: row.report_id,
      reportName: row.report_name,
      propertyName: row.property_name,
      dateRangeLabel: row.date_range_label,
      datePreset: row.date_preset as ReportScheduleContext["datePreset"],
      dateStart: row.date_start,
      dateEnd: row.date_end,
      filterLines: row.filter_lines,
      filterSnapshot: row.filter_snapshot as ReportScheduleContext["filterSnapshot"],
      inspectionVariant: row.inspection_variant as ReportScheduleContext["inspectionVariant"],
    },
    timezone: row.timezone,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastError: row.last_error,
  };
}

export async function listScheduledReportSchedules(
  supabase: SupabaseClient
): Promise<SavedReportScheduleWithMeta[]> {
  const { data, error } = await supabase
    .from("scheduled_report_schedules")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data || []) as ScheduledReportScheduleRow[]).map(rowToSavedSchedule);
}

export async function getScheduledReportScheduleById(
  supabase: SupabaseClient,
  id: string
): Promise<SavedReportScheduleWithMeta | null> {
  const { data, error } = await supabase
    .from("scheduled_report_schedules")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToSavedSchedule(data as ScheduledReportScheduleRow);
}

export async function createScheduledReportSchedule(
  supabase: SupabaseClient,
  input: CreateScheduledReportInput
): Promise<SavedReportScheduleWithMeta> {
  const { schedule, context, timezone, nextRunAt, createdBy } = input;
  const { data, error } = await supabase
    .from("scheduled_report_schedules")
    .insert({
      created_by: createdBy,
      report_module: context.reportModule,
      report_id: context.reportId,
      report_name: schedule.reportName || context.reportName,
      property_name: schedule.property || context.propertyName,
      date_range_label: context.dateRangeLabel,
      date_preset: context.datePreset,
      date_start: context.dateStart,
      date_end: context.dateEnd,
      filter_lines: context.filterLines,
      filter_snapshot: context.filterSnapshot,
      inspection_variant: context.inspectionVariant ?? null,
      recipients: schedule.recipients,
      frequency: schedule.frequency,
      repeat_every: schedule.repeatEvery,
      interval_unit: schedule.intervalUnit,
      weekly_day: schedule.frequency === "weekly" ? schedule.weeklyDay : null,
      monthly_day: schedule.frequency === "monthly" ? schedule.monthlyDay : null,
      schedule_time: schedule.time,
      timezone,
      start_date: schedule.startDate,
      end_date: schedule.endDate || null,
      active: schedule.active,
      next_run_at: nextRunAt,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToSavedSchedule(data as ScheduledReportScheduleRow);
}

export async function deleteScheduledReportSchedule(
  supabase: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await supabase.from("scheduled_report_schedules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function claimDueScheduledReportSchedules(
  supabase: SupabaseClient,
  nowIso: string
): Promise<ScheduledReportScheduleRow[]> {
  const { data: dueRows, error } = await supabase
    .from("scheduled_report_schedules")
    .select("*")
    .eq("active", true)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(25);

  if (error) throw new Error(error.message);
  const claimed: ScheduledReportScheduleRow[] = [];

  for (const row of (dueRows || []) as ScheduledReportScheduleRow[]) {
    const claimToken = crypto.randomUUID();
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: claimedRows, error: claimError } = await supabase.rpc(
      "claim_scheduled_report_schedule",
      {
        p_schedule_id: row.id,
        p_claim_token: claimToken,
        p_now: nowIso,
        p_stale_before: staleBefore,
      }
    );

    if (claimError) {
      console.error("[scheduled-reports] claim failed", {
        scheduleId: row.id,
        error: claimError.message,
      });
      continue;
    }

    const claimedRow = Array.isArray(claimedRows) ? claimedRows[0] : claimedRows;
    if (
      claimedRow &&
      (claimedRow as ScheduledReportScheduleRow).processing_claim_token === claimToken
    ) {
      claimed.push(claimedRow as ScheduledReportScheduleRow);
      console.info("[scheduled-reports] schedule claimed", { scheduleId: row.id });
    }
  }

  return claimed;
}

export async function releaseScheduleClaim(
  supabase: SupabaseClient,
  scheduleId: string,
  claimToken: string
): Promise<void> {
  await supabase
    .from("scheduled_report_schedules")
    .update({
      processing_claimed_at: null,
      processing_claim_token: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId)
    .eq("processing_claim_token", claimToken);
}

export async function updateScheduleAfterRun(
  supabase: SupabaseClient,
  input: {
    scheduleId: string;
    claimToken: string;
    lastRunAt: string;
    lastStatus: "sent" | "failed";
    lastError: string | null;
    nextRunAt: string | null;
    active: boolean;
  }
): Promise<void> {
  const { error } = await supabase
    .from("scheduled_report_schedules")
    .update({
      last_run_at: input.lastRunAt,
      last_status: input.lastStatus,
      last_error: input.lastError,
      next_run_at: input.nextRunAt,
      active: input.active,
      processing_claimed_at: null,
      processing_claim_token: null,
      updated_at: input.lastRunAt,
    })
    .eq("id", input.scheduleId)
    .eq("processing_claim_token", input.claimToken);

  if (error) throw new Error(error.message);
}

export async function insertScheduledReportRun(
  supabase: SupabaseClient,
  input: {
    scheduleId: string;
    triggeredBy: "cron" | "test";
    status: "sent" | "failed";
    error: string | null;
    resendMessageId: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("scheduled_report_runs").insert({
    schedule_id: input.scheduleId,
    triggered_by: input.triggeredBy,
    status: input.status,
    error: input.error,
    resend_message_id: input.resendMessageId,
  });

  if (error) throw new Error(error.message);
}

export function scheduleRowToTiming(row: ScheduledReportScheduleRow) {
  return {
    frequency: row.frequency as ReportScheduleFormValues["frequency"],
    repeatEvery: row.repeat_every,
    intervalUnit: row.interval_unit as ReportScheduleFormValues["intervalUnit"],
    weeklyDay: (row.weekly_day || "Monday") as ReportScheduleFormValues["weeklyDay"],
    monthlyDay: row.monthly_day || 1,
    time: row.schedule_time,
    startDate: row.start_date,
    endDate: row.end_date || "",
    timezone: row.timezone,
  };
}

export function scheduleRowToContext(row: ScheduledReportScheduleRow): ReportScheduleContext {
  return {
    reportModule: row.report_module as ReportScheduleContext["reportModule"],
    reportId: row.report_id,
    reportName: row.report_name,
    propertyName: row.property_name,
    dateRangeLabel: row.date_range_label,
    datePreset: row.date_preset as ReportScheduleContext["datePreset"],
    dateStart: row.date_start,
    dateEnd: row.date_end,
    filterLines: row.filter_lines,
    filterSnapshot: row.filter_snapshot as ReportScheduleContext["filterSnapshot"],
    inspectionVariant: row.inspection_variant as ReportScheduleContext["inspectionVariant"],
  };
}

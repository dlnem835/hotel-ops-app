import { advanceDueDate, parseDate } from "@/app/maintenance/lib/schedule-engine";
import type { PmFrequency } from "@/app/maintenance/lib/pm-types";
import type { PmReportSourceOccurrence } from "@/app/reports/lib/pm-report-types";

export type PmReportOverviewPeriodStatus =
  | "completed_on_time"
  | "completed_before_next_due"
  | "missed"
  | "not_yet_due";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getOverviewNextDueDate(
  dueDateIso: string,
  frequency: PmFrequency
): string {
  return advanceDueDate(dueDateIso, frequency);
}

export function resolveOverviewPeriodStatus(
  dueDateIso: string,
  frequency: PmFrequency,
  occurrence: PmReportSourceOccurrence | undefined,
  now = new Date()
): PmReportOverviewPeriodStatus {
  const nextDueDateIso = getOverviewNextDueDate(dueDateIso, frequency);
  const dueDay = startOfDay(parseDate(dueDateIso));
  const nextDueDay = startOfDay(parseDate(nextDueDateIso));
  const today = startOfDay(now);

  if (occurrence?.status === "completed" && occurrence.completedAt) {
    const completedDay = startOfDay(new Date(occurrence.completedAt));
    if (completedDay.getTime() <= dueDay.getTime()) {
      return "completed_on_time";
    }
    if (completedDay.getTime() < nextDueDay.getTime()) {
      return "completed_before_next_due";
    }
    return "completed_before_next_due";
  }

  if (occurrence?.status === "missed") {
    return "missed";
  }

  if (today.getTime() >= nextDueDay.getTime()) {
    return "missed";
  }

  return "not_yet_due";
}

export function formatOverviewPeriodStatusTitle(
  status: PmReportOverviewPeriodStatus
): string {
  switch (status) {
    case "completed_on_time":
      return "Completed On Time";
    case "completed_before_next_due":
      return "Completed Before Next Due Date";
    case "missed":
      return "Missed";
    case "not_yet_due":
      return "Not Yet Due";
  }
}

export function getOverviewPeriodClassName(
  status: PmReportOverviewPeriodStatus
): string {
  switch (status) {
    case "completed_on_time":
      return "reports-pm-results__period reports-pm-results__period--completed";
    case "completed_before_next_due":
      return "reports-pm-results__period reports-pm-results__period--before-next-due";
    case "missed":
      return "reports-pm-results__period reports-pm-results__period--missed";
    case "not_yet_due":
      return "reports-pm-results__period reports-pm-results__period--upcoming";
  }
}

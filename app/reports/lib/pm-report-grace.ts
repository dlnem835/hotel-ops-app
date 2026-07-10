import { parseDate } from "@/app/maintenance/lib/schedule-engine";

/** Matches the PM due-soon window used across maintenance scheduling. */
export const PM_REPORT_GRACE_PERIOD_DAYS = 7;

export type PmReportCompletionTiming = "on_time" | "within_grace" | "late";

export type PmOccurrenceLookupStatus = "completed" | "open" | "missed" | "none";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addGracePeriodDays(dueDateIso: string): string {
  const graceEnd = startOfDay(parseDate(dueDateIso));
  graceEnd.setDate(graceEnd.getDate() + PM_REPORT_GRACE_PERIOD_DAYS);
  return formatIso(graceEnd);
}

export function classifyPmReportCompletionTiming(
  completedAt: string | null | undefined,
  dueDateIso: string
): PmReportCompletionTiming | null {
  if (!completedAt) return null;

  const completedDay = startOfDay(new Date(completedAt));
  const dueDay = startOfDay(parseDate(dueDateIso));
  const graceEnd = startOfDay(parseDate(addGracePeriodDays(dueDateIso)));

  if (completedDay.getTime() <= dueDay.getTime()) {
    return "on_time";
  }

  if (completedDay.getTime() <= graceEnd.getTime()) {
    return "within_grace";
  }

  return "late";
}

export function formatPmReportCompletionStatusLabel(
  timing: PmReportCompletionTiming
): string {
  switch (timing) {
    case "on_time":
      return "Completed On Time";
    case "within_grace":
      return "Completed Within Grace Period";
    case "late":
      return "Completed Late";
  }
}

export function isPmMissedAfterGracePeriod(
  dueDateIso: string,
  occurrenceStatus: PmOccurrenceLookupStatus,
  now = new Date()
): boolean {
  if (occurrenceStatus === "completed") return false;
  if (occurrenceStatus === "missed") return true;

  const graceEnd = startOfDay(parseDate(addGracePeriodDays(dueDateIso)));
  return startOfDay(now).getTime() > graceEnd.getTime();
}

export function calculateDaysMissedAfterGrace(
  dueDateIso: string,
  now = new Date()
): number {
  const graceEnd = startOfDay(parseDate(addGracePeriodDays(dueDateIso)));
  const today = startOfDay(now);

  if (today.getTime() <= graceEnd.getTime()) {
    return 0;
  }

  return Math.ceil((today.getTime() - graceEnd.getTime()) / (24 * 60 * 60 * 1000));
}

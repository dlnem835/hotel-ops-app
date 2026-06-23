import { advanceDueDate, formatDate, parseDate } from "./schedule-engine";
import { PmAssignmentSchedule, PmFrequency } from "./pm-types";

export type PmWorkloadLevel = "none" | "light" | "moderate" | "heavy";

export type PmDayEntry = {
  name: string;
};

export type PmDayWorkload = {
  date: string;
  pmCount: number;
  pms: PmDayEntry[];
  level: PmWorkloadLevel;
};

export type PmDraftPreview = {
  name: string;
  frequency: PmFrequency;
};

const WORKLOAD_HEAVY_COUNT = 5;
const WORKLOAD_MODERATE_COUNT = 3;

export function getWorkloadLevel(pmCount: number): PmWorkloadLevel {
  if (pmCount === 0) return "none";
  if (pmCount >= WORKLOAD_HEAVY_COUNT) return "heavy";
  if (pmCount >= WORKLOAD_MODERATE_COUNT) return "moderate";
  return "light";
}

export function formatWorkloadLabel(level: PmWorkloadLevel): string {
  switch (level) {
    case "none":
      return "NO PMs SCHEDULED";
    case "light":
      return "LIGHT WORKLOAD";
    case "moderate":
      return "MODERATE WORKLOAD";
    case "heavy":
      return "HEAVY WORKLOAD";
    default:
      return "—";
  }
}

export function getDueDatesInMonth(
  startDateIso: string,
  frequency: PmFrequency,
  endDateIso: string | null,
  year: number,
  month: number
): string[] {
  const rangeStart = formatDate(new Date(year, month, 1));
  const rangeEnd = formatDate(new Date(year, month + 1, 0));

  if (endDateIso && parseDate(startDateIso) > parseDate(endDateIso)) {
    return [];
  }

  let due = startDateIso;

  while (parseDate(due) < parseDate(rangeStart)) {
    const next = advanceDueDate(due, frequency);
    if (endDateIso && parseDate(next) > parseDate(endDateIso)) {
      return [];
    }
    due = next;
  }

  const dates: string[] = [];
  while (parseDate(due) <= parseDate(rangeEnd)) {
    if (!endDateIso || parseDate(due) <= parseDate(endDateIso)) {
      dates.push(due);
    }
    const next = advanceDueDate(due, frequency);
    if (endDateIso && parseDate(next) > parseDate(endDateIso)) {
      break;
    }
    due = next;
  }

  return dates;
}

function buildDayWorkload(date: string, pms: PmDayEntry[]): PmDayWorkload {
  return {
    date,
    pmCount: pms.length,
    pms,
    level: getWorkloadLevel(pms.length),
  };
}

export function buildMonthWorkloadMap(
  schedules: PmAssignmentSchedule[],
  year: number,
  month: number,
  options?: {
    excludeTemplateId?: number | null;
    draft?: PmDraftPreview | null;
    draftOnDate?: string | null;
  }
): Map<string, PmDayWorkload> {
  const byDate = new Map<string, PmDayEntry[]>();

  for (const schedule of schedules) {
    if (
      schedule.templateStatus !== "Active" ||
      schedule.assignmentStatus !== "Active"
    ) {
      continue;
    }

    if (
      options?.excludeTemplateId &&
      schedule.templateId === options.excludeTemplateId
    ) {
      continue;
    }

    const dueDates = getDueDatesInMonth(
      schedule.startDate,
      schedule.frequency,
      schedule.endDate,
      year,
      month
    );

    for (const date of dueDates) {
      const entries = byDate.get(date) || [];
      entries.push({ name: schedule.templateName });
      byDate.set(date, entries);
    }
  }

  if (options?.draft && options.draftOnDate) {
    const draftDueDates = getDueDatesInMonth(
      options.draftOnDate,
      options.draft.frequency,
      null,
      year,
      month
    );

    for (const date of draftDueDates) {
      const entries = byDate.get(date) || [];
      entries.push({
        name: options.draft.name.trim() || "New PM Template",
      });
      byDate.set(date, entries);
    }
  }

  const workload = new Map<string, PmDayWorkload>();
  for (const [date, pms] of byDate) {
    workload.set(date, buildDayWorkload(date, pms));
  }

  return workload;
}

export function getDayWorkload(
  workloadMap: Map<string, PmDayWorkload>,
  date: string
): PmDayWorkload {
  return (
    workloadMap.get(date) || {
      date,
      pmCount: 0,
      pms: [],
      level: "none",
    }
  );
}

export function formatLongDate(dateIso: string): string {
  const date = parseDate(dateIso);
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

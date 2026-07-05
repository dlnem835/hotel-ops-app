import { PmFrequency } from "./pm-types";
import {
  advanceDueDate,
  enumerateDueDatesInRange,
  getActiveDueDate,
  parseDate,
} from "./schedule-engine";

export type PmCycleStatus = "completed" | "missed" | "due" | "upcoming";

export type PmCycleEntry = {
  label: string;
  dueDate: string;
  status: PmCycleStatus;
};

export type PmCycleHistory = {
  entries: PmCycleEntry[];
  completedCount: number;
  totalCount: number;
  summaryLabel: string;
};

export type PmOccurrenceLookupStatus = "completed" | "open" | "missed" | "none";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCalendarYearRange(now: Date): { start: Date; end: Date } {
  const year = now.getFullYear();
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
  };
}

function getCycleLabel(frequency: PmFrequency, dueDate: Date): string {
  switch (frequency) {
    case "monthly":
    case "bimonthly":
      return MONTH_LABELS[dueDate.getMonth()];
    case "quarterly":
    case "triannually":
      return `Q${Math.floor(dueDate.getMonth() / 3) + 1}`;
    case "semiannually":
      return dueDate.getMonth() < 6 ? "H1" : "H2";
    case "yearly":
      return String(dueDate.getFullYear());
    case "weekly":
    case "biweekly": {
      const week = Math.ceil(dueDate.getDate() / 7);
      return `W${week}`;
    }
    case "daily":
      return dueDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    default:
      return dueDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
  }
}

function usesDetailedCycleLabels(frequency: PmFrequency): boolean {
  return [
    "monthly",
    "bimonthly",
    "quarterly",
    "triannually",
    "semiannually",
    "yearly",
  ].includes(frequency);
}

export function enumeratePastDueDatesBeforeActive(
  startDateIso: string,
  frequency: PmFrequency,
  endDateIso: string | null,
  activeDueDateIso: string,
  now = new Date()
): string[] {
  const activeDay = startOfDay(parseDate(activeDueDateIso));
  const rangeEnd = new Date(activeDay);
  rangeEnd.setDate(rangeEnd.getDate() - 1);

  if (rangeEnd < parseDate(startDateIso)) {
    return [];
  }

  return enumerateDueDatesInRange(
    startDateIso,
    frequency,
    endDateIso,
    parseDate(startDateIso),
    rangeEnd
  );
}

export function resolveCycleStatus(
  dueDateIso: string,
  activeDueDateIso: string,
  occurrenceStatus: PmOccurrenceLookupStatus,
  now = new Date()
): PmCycleStatus {
  if (occurrenceStatus === "completed") {
    return "completed";
  }

  if (occurrenceStatus === "missed") {
    return "missed";
  }

  const dueDay = startOfDay(parseDate(dueDateIso));
  const activeDay = startOfDay(parseDate(activeDueDateIso));
  const today = startOfDay(now);

  if (dueDay.getTime() === activeDay.getTime()) {
    if (occurrenceStatus === "open" || dueDay <= today) {
      return "due";
    }
    return "upcoming";
  }

  if (dueDay < activeDay) {
    return "missed";
  }

  return "upcoming";
}

export function buildPmCycleHistory(input: {
  frequency: PmFrequency;
  startDate: string;
  endDate: string | null;
  activeDueDate: string | null;
  occurrenceByDueDate: Map<string, PmOccurrenceLookupStatus>;
  now?: Date;
}): PmCycleHistory {
  const now = input.now ?? new Date();

  if (!input.activeDueDate) {
    return {
      entries: [],
      completedCount: 0,
      totalCount: 0,
      summaryLabel: "0 of 0 Completed",
    };
  }

  const { start, end } = getCalendarYearRange(now);
  const dueDates = enumerateDueDatesInRange(
    input.startDate,
    input.frequency,
    input.endDate,
    start,
    end
  );

  const entries: PmCycleEntry[] = dueDates.map((dueDate) => {
    const lookup =
      input.occurrenceByDueDate.get(dueDate) ?? ("none" as PmOccurrenceLookupStatus);
    return {
      label: getCycleLabel(input.frequency, parseDate(dueDate)),
      dueDate,
      status: resolveCycleStatus(
        dueDate,
        input.activeDueDate!,
        lookup,
        now
      ),
    };
  });

  const completedCount = entries.filter((entry) => entry.status === "completed").length;
  const totalCount = entries.length;

  return {
    entries: [],
    completedCount,
    totalCount,
    summaryLabel:
      totalCount === 0
        ? "0 of 0 Completed"
        : `${completedCount} of ${totalCount} Completed`,
  };
}

export function formatPmCycleStatusLabel(status: PmCycleStatus): string {
  switch (status) {
    case "completed":
      return "✓";
    case "missed":
      return "Missed";
    case "due":
      return "Due";
    case "upcoming":
      return "Upcoming";
  }
}

export function calculatePmHealthPercent(input: {
  completed: number;
  missed: number;
  pastDueOpen: number;
}): number {
  const denominator = input.completed + input.missed + input.pastDueOpen;
  if (denominator === 0) return 100;
  return Math.round((input.completed / denominator) * 100);
}

export function getActiveDueDateForAssignment(
  startDate: string,
  frequency: PmFrequency,
  endDate: string | null,
  now = new Date()
): string | null {
  return getActiveDueDate(startDate, frequency, endDate, now);
}

export function getNextDueDateAfter(
  dueDateIso: string,
  frequency: PmFrequency
): string {
  return advanceDueDate(dueDateIso, frequency);
}

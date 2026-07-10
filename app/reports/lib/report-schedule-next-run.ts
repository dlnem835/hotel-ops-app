import type {
  ReportScheduleFormValues,
  ReportScheduleWeekday,
} from "@/app/reports/lib/report-schedule-types";

const WEEKDAY_INDEX: Record<ReportScheduleWeekday, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export type ScheduleTimingInput = Pick<
  ReportScheduleFormValues,
  | "frequency"
  | "repeatEvery"
  | "intervalUnit"
  | "weeklyDay"
  | "monthlyDay"
  | "time"
  | "startDate"
  | "endDate"
> & {
  timezone: string;
};

function parseTime(time: string): { hour: number; minute: number } {
  const [hourPart, minutePart] = time.split(":");
  return {
    hour: Number(hourPart) || 0,
    minute: Number(minutePart) || 0,
  };
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const zoned = new Date(date.toLocaleString("en-US", { timeZone }));
  return (zoned.getTime() - utc.getTime()) / 60000;
}

export function zonedLocalDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, utc);
    utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60000);
  }
  return utc;
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  const weekday = read("weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    weekday: weekdayMap[weekday] ?? 0,
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
}

function addDays(year: number, month: number, day: number, amount: number) {
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addMonths(year: number, month: number, day: number, amount: number) {
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: Math.min(day, lastDay),
  };
}

function isAfterEndDate(candidateUtc: Date, endDate: string, timeZone: string): boolean {
  if (!endDate) return false;
  const [year, month, day] = endDate.split("-").map(Number);
  const endUtc = zonedLocalDateTimeToUtc(year, month, day, 23, 59, timeZone);
  return candidateUtc.getTime() > endUtc.getTime();
}

function buildCandidateUtc(
  year: number,
  month: number,
  day: number,
  schedule: ScheduleTimingInput
): Date {
  const { hour, minute } = parseTime(schedule.time);
  return zonedLocalDateTimeToUtc(year, month, day, hour, minute, schedule.timezone);
}

function advanceDaily(parts: { year: number; month: number; day: number }, repeatEvery: number) {
  return addDays(parts.year, parts.month, parts.day, repeatEvery);
}

function advanceWeekly(
  parts: { year: number; month: number; day: number; weekday: number },
  repeatEvery: number,
  weeklyDay: ReportScheduleWeekday
) {
  const target = WEEKDAY_INDEX[weeklyDay];
  let delta = (target - parts.weekday + 7) % 7;
  if (delta === 0) delta = 7 * repeatEvery;
  else if (repeatEvery > 1) delta += 7 * (repeatEvery - 1);
  return addDays(parts.year, parts.month, parts.day, delta);
}

function advanceMonthly(
  parts: { year: number; month: number; day: number },
  repeatEvery: number,
  monthlyDay: number
) {
  let next = addMonths(parts.year, parts.month, monthlyDay, repeatEvery);
  if (
    next.year === parts.year &&
    next.month === parts.month &&
    next.day === parts.day &&
    parts.day < monthlyDay
  ) {
    next = addMonths(parts.year, parts.month, monthlyDay, repeatEvery);
  }
  return next;
}

export function computeNextRunAtUtc(
  schedule: ScheduleTimingInput,
  afterUtc: Date = new Date()
): string | null {
  const { hour, minute } = parseTime(schedule.time);
  const [startYear, startMonth, startDay] = schedule.startDate.split("-").map(Number);
  let parts = {
    year: startYear,
    month: startMonth,
    day: startDay,
    weekday: getZonedParts(
      zonedLocalDateTimeToUtc(startYear, startMonth, startDay, hour, minute, schedule.timezone),
      schedule.timezone
    ).weekday,
  };

  let candidate = buildCandidateUtc(parts.year, parts.month, parts.day, schedule);
  if (candidate <= afterUtc) {
    const local = getZonedParts(afterUtc, schedule.timezone);
    parts = { ...local };

    if (schedule.frequency === "daily") {
      parts = { ...advanceDaily(parts, 0), weekday: local.weekday };
      candidate = buildCandidateUtc(parts.year, parts.month, parts.day, schedule);
      if (candidate <= afterUtc) {
        parts = { ...advanceDaily(parts, schedule.repeatEvery), weekday: local.weekday };
        candidate = buildCandidateUtc(parts.year, parts.month, parts.day, schedule);
      }
    } else if (schedule.frequency === "weekly") {
      parts = {
        ...advanceWeekly(parts, 0, schedule.weeklyDay),
        weekday: WEEKDAY_INDEX[schedule.weeklyDay],
      };
      candidate = buildCandidateUtc(parts.year, parts.month, parts.day, schedule);
      if (candidate <= afterUtc) {
        parts = {
          ...advanceWeekly(local, schedule.repeatEvery, schedule.weeklyDay),
          weekday: WEEKDAY_INDEX[schedule.weeklyDay],
        };
        candidate = buildCandidateUtc(parts.year, parts.month, parts.day, schedule);
      }
    } else {
      parts = {
        ...advanceMonthly(parts, 0, schedule.monthlyDay),
        weekday: local.weekday,
      };
      candidate = buildCandidateUtc(parts.year, parts.month, parts.day, schedule);
      if (candidate <= afterUtc) {
        parts = {
          ...advanceMonthly(local, schedule.repeatEvery, schedule.monthlyDay),
          weekday: local.weekday,
        };
        candidate = buildCandidateUtc(parts.year, parts.month, parts.day, schedule);
      }
    }
  }

  for (let guard = 0; guard < 400; guard += 1) {
    if (candidate > afterUtc) {
      if (isAfterEndDate(candidate, schedule.endDate, schedule.timezone)) {
        return null;
      }
      return candidate.toISOString();
    }

    const local = getZonedParts(candidate, schedule.timezone);
    if (schedule.frequency === "daily") {
      parts = { ...advanceDaily(local, schedule.repeatEvery), weekday: local.weekday };
    } else if (schedule.frequency === "weekly") {
      parts = {
        ...advanceWeekly(local, schedule.repeatEvery, schedule.weeklyDay),
        weekday: WEEKDAY_INDEX[schedule.weeklyDay],
      };
    } else {
      parts = {
        ...advanceMonthly(local, schedule.repeatEvery, schedule.monthlyDay),
        weekday: local.weekday,
      };
    }
    candidate = buildCandidateUtc(parts.year, parts.month, parts.day, schedule);
  }

  return null;
}

export function computeFollowingRunAtUtc(
  schedule: ScheduleTimingInput,
  previousRunUtc: Date
): string | null {
  return computeNextRunAtUtc(schedule, previousRunUtc);
}

export function resolveClientTimezone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  }
  return "America/New_York";
}

import { InspectionPeriod, PeriodBounds } from "./inspection-types";

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getWeekStart(date: Date, weekStartsOn: "monday" | "sunday"): Date {
  const day = date.getDay();
  const diff =
    weekStartsOn === "monday"
      ? day === 0
        ? 6
        : day - 1
      : day;
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() - diff);
  return start;
}

function getQuarterStart(date: Date): Date {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterMonth, 1);
}

export function getMtdMonthBounds(
  year: number,
  month: number,
  now = new Date()
): PeriodBounds {
  const start = new Date(year, month, 1);
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();
  const end = isCurrentMonth
    ? now
    : new Date(year, month + 1, 0, 23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function parseMtdMonthYear(
  monthParam: string | null,
  yearParam: string | null,
  now = new Date()
): { year: number; month: number } {
  const parsedYear = yearParam ? Number.parseInt(yearParam, 10) : now.getFullYear();
  const parsedMonth = monthParam
    ? Number.parseInt(monthParam, 10) - 1
    : now.getMonth();

  if (
    Number.isFinite(parsedYear) &&
    Number.isFinite(parsedMonth) &&
    parsedMonth >= 0 &&
    parsedMonth <= 11 &&
    parsedYear >= 2000 &&
    parsedYear <= 2100
  ) {
    const selected = new Date(parsedYear, parsedMonth, 1);
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    if (selected <= current) {
      return { year: parsedYear, month: parsedMonth };
    }
  }

  return { year: now.getFullYear(), month: now.getMonth() };
}

export function formatMonthYearLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function shiftCalendarMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const shifted = new Date(year, month + delta, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}

export function isAtOrAfterCurrentMonth(
  year: number,
  month: number,
  now = new Date()
): boolean {
  return (
    year > now.getFullYear() ||
    (year === now.getFullYear() && month >= now.getMonth())
  );
}

export function getPeriodBounds(
  period: InspectionPeriod,
  now = new Date(),
  weekStartsOn: "monday" | "sunday" = "monday"
): PeriodBounds {
  const end = new Date(now);
  let start: Date;

  switch (period) {
    case "today":
      start = startOfLocalDay(now);
      break;
    case "wtd":
      start = getWeekStart(now, weekStartsOn);
      break;
    case "mtd":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "qtd":
      start = getQuarterStart(now);
      break;
    case "ytd":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = startOfLocalDay(now);
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export function parsePeriod(value: string | null): InspectionPeriod {
  const normalized = (value || "mtd").toLowerCase();
  if (
    normalized === "today" ||
    normalized === "wtd" ||
    normalized === "mtd" ||
    normalized === "qtd" ||
    normalized === "ytd"
  ) {
    return normalized;
  }
  return "mtd";
}

export function parseDashboardProgram(value: string | null): "VR" | "RPM" {
  const normalized = (value || "vr").toUpperCase();
  return normalized === "RPM" ? "RPM" : "VR";
}

export function daysSince(iso: string | null, now = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

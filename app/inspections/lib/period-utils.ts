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

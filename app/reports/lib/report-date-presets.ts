import { getPeriodBounds } from "@/app/inspections/lib/period-utils";
import type { InspectionPeriod } from "@/app/inspections/lib/inspection-types";

export const REPORT_DATE_PRESETS = [
  "today",
  "wtd",
  "mtd",
  "qtd",
  "ytd",
  "custom",
] as const;

export type ReportDatePreset = (typeof REPORT_DATE_PRESETS)[number];

export const REPORT_DATE_PRESET_LABELS: Record<ReportDatePreset, string> = {
  today: "Today",
  wtd: "WTD",
  mtd: "MTD",
  qtd: "QTD",
  ytd: "YTD",
  custom: "Custom",
};

export const DEFAULT_REPORT_DATE_PRESET: ReportDatePreset = "mtd";

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getReportDateRangeForPreset(
  preset: ReportDatePreset,
  now = new Date()
): { dateStart: string; dateEnd: string } {
  if (preset === "custom") {
    return { dateStart: "", dateEnd: "" };
  }

  const bounds = getPeriodBounds(preset as InspectionPeriod, now);
  return {
    dateStart: toDateInputValue(new Date(bounds.start)),
    dateEnd: toDateInputValue(new Date(bounds.end)),
  };
}

export function applyDefaultReportDateRange<T extends { dateStart: string; dateEnd: string }>(
  filters: T,
  preset: ReportDatePreset = DEFAULT_REPORT_DATE_PRESET
): T {
  const { dateStart, dateEnd } = getReportDateRangeForPreset(preset);
  return { ...filters, dateStart, dateEnd };
}

import type { ReportDatePreset } from "@/app/reports/lib/report-date-presets";

export type ReportScheduleModule = "pm" | "wo" | "inspection" | "lnf" | "pass-on";

export type ReportScheduleFrequency = "daily" | "weekly" | "monthly";

export type ReportScheduleIntervalUnit = "day" | "week" | "month";

export const REPORT_SCHEDULE_WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type ReportScheduleWeekday = (typeof REPORT_SCHEDULE_WEEKDAYS)[number];

export type ReportScheduleContext = {
  reportModule: ReportScheduleModule;
  reportId: string;
  reportName: string;
  propertyName: string;
  dateRangeLabel: string;
  datePreset: ReportDatePreset;
  dateStart: string;
  dateEnd: string;
  filterLines: string[];
  filterSnapshot: Record<string, string | number | boolean | null>;
  inspectionVariant?: "room" | "rpm";
};

export type ReportScheduleFormValues = {
  reportName: string;
  property: string;
  recipients: string;
  frequency: ReportScheduleFrequency;
  repeatEvery: number;
  intervalUnit: ReportScheduleIntervalUnit;
  weeklyDay: ReportScheduleWeekday;
  monthlyDay: number;
  time: string;
  startDate: string;
  endDate: string;
  active: boolean;
};

export type SavedReportSchedule = {
  id: string;
  createdAt: string;
  updatedAt: string;
  schedule: ReportScheduleFormValues;
  context: ReportScheduleContext;
};

export function frequencyToIntervalUnit(
  frequency: ReportScheduleFrequency
): ReportScheduleIntervalUnit {
  if (frequency === "daily") return "day";
  if (frequency === "weekly") return "week";
  return "month";
}

export function intervalUnitLabel(unit: ReportScheduleIntervalUnit, count: number): string {
  if (unit === "day") return count === 1 ? "day" : "days";
  if (unit === "week") return count === 1 ? "week" : "weeks";
  return count === 1 ? "month" : "months";
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDefaultScheduleForm(
  context: ReportScheduleContext
): ReportScheduleFormValues {
  return {
    reportName: context.reportName,
    property: context.propertyName,
    recipients: "",
    frequency: "weekly",
    repeatEvery: 1,
    intervalUnit: "week",
    weeklyDay: "Monday",
    monthlyDay: 1,
    time: "08:00",
    startDate: toDateInputValue(new Date()),
    endDate: "",
    active: true,
  };
}

export function formatScheduleSummary(schedule: ReportScheduleFormValues): string {
  const interval = `Every ${schedule.repeatEvery} ${intervalUnitLabel(
    schedule.intervalUnit,
    schedule.repeatEvery
  )}`;

  if (schedule.frequency === "weekly") {
    return `${interval} on ${schedule.weeklyDay} at ${schedule.time}`;
  }

  if (schedule.frequency === "monthly") {
    return `${interval} on day ${schedule.monthlyDay} at ${schedule.time}`;
  }

  return `${interval} at ${schedule.time}`;
}

import type { PmReportFilters } from "@/app/reports/lib/report-definitions";
import { PM_TYPE_FILTER_OPTIONS } from "@/app/reports/lib/report-definitions";
import type { PmFrequency } from "@/app/maintenance/lib/pm-types";
import { PM_FREQUENCY_LABELS } from "@/app/maintenance/lib/pm-types";

const PM_TYPE_TO_FREQUENCIES: Record<
  (typeof PM_TYPE_FILTER_OPTIONS)[number],
  PmFrequency[] | null
> = {
  All: null,
  Daily: ["daily"],
  Weekly: ["weekly", "biweekly"],
  Monthly: ["monthly", "bimonthly"],
  Quarterly: ["quarterly"],
  Triannually: ["triannually"],
  "Semi-Annual": ["semiannually"],
  Annual: ["yearly"],
};

export function matchesPmTypeFilter(
  frequency: PmFrequency,
  filterPmType: string
): boolean {
  const allowed =
    PM_TYPE_TO_FREQUENCIES[filterPmType as (typeof PM_TYPE_FILTER_OPTIONS)[number]];
  if (!allowed) return true;
  return allowed.includes(frequency);
}

export function getPmTypeFilterLabel(frequency: PmFrequency): string {
  return PM_FREQUENCY_LABELS[frequency];
}

export function matchesPmDateRange(
  dateIso: string | null | undefined,
  filters: Pick<PmReportFilters, "dateStart" | "dateEnd">
): boolean {
  if (!filters.dateStart && !filters.dateEnd) return true;
  if (!dateIso) return false;
  if (filters.dateStart && dateIso < filters.dateStart) return false;
  if (filters.dateEnd && dateIso > filters.dateEnd) return false;
  return true;
}

export function matchesPmCompletedByFilter(
  completedByLabel: string,
  filterCompletedBy: string
): boolean {
  if (filterCompletedBy === "All") return true;
  return completedByLabel === filterCompletedBy;
}

export function isActivePmSchedule(schedule: {
  templateStatus: string;
  assignmentStatus: string;
}): boolean {
  return schedule.templateStatus === "Active" && schedule.assignmentStatus === "Active";
}

export function getReportDateRangeBounds(
  filters: Pick<PmReportFilters, "dateStart" | "dateEnd">
): { start: Date; end: Date } {
  const start = filters.dateStart
    ? new Date(`${filters.dateStart}T00:00:00`)
    : new Date(1970, 0, 1);
  const end = filters.dateEnd
    ? new Date(`${filters.dateEnd}T23:59:59`)
    : new Date(2099, 11, 31, 23, 59, 59);
  return { start, end };
}

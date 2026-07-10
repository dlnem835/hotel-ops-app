import type { PmReportCompletionTiming } from "@/app/reports/lib/pm-report-grace";
import type { PmReportCompletedRow } from "@/app/reports/lib/pm-report-types";
import { PM_FREQUENCY_ORDER } from "@/app/maintenance/lib/pm-types";

export type CompletedPmsSortColumn =
  | "pmName"
  | "pmType"
  | "areaLabel"
  | "frequency"
  | "dueDate"
  | "completedAt"
  | "completedBy"
  | "completionStatus"
  | "cycleLabel";

export type PmReportSortDirection = "asc" | "desc";

const COMPLETION_STATUS_ORDER: Record<PmReportCompletionTiming, number> = {
  on_time: 0,
  within_grace: 1,
  late: 2,
};

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function compareIsoDateTime(left: string, right: string): number {
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();

  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
    return compareStrings(left, right);
  }
  if (Number.isNaN(leftTime)) return 1;
  if (Number.isNaN(rightTime)) return -1;
  return leftTime - rightTime;
}

function getSortValue(
  row: PmReportCompletedRow,
  column: CompletedPmsSortColumn
): string | number {
  switch (column) {
    case "pmName":
      return row.pmName;
    case "pmType":
      return PM_FREQUENCY_ORDER[row.pmTypeKey];
    case "areaLabel":
      return row.areaLabel;
    case "frequency":
      return PM_FREQUENCY_ORDER[row.pmTypeKey];
    case "dueDate":
      return row.dueDateIso;
    case "completedAt":
      return row.completedAtSortIso;
    case "completedBy":
      return row.completedBy;
    case "completionStatus":
      return COMPLETION_STATUS_ORDER[row.completionStatus];
    case "cycleLabel":
      return row.dueDateIso;
    default:
      return "";
  }
}

export function sortCompletedPmReportRows(
  rows: PmReportCompletedRow[],
  column: CompletedPmsSortColumn,
  direction: PmReportSortDirection
): PmReportCompletedRow[] {
  const sorted = [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, column);
    const rightValue = getSortValue(right, column);

    let comparison = 0;
    if (column === "dueDate" || column === "completedAt" || column === "cycleLabel") {
      comparison = compareIsoDateTime(String(leftValue), String(rightValue));
    } else if (typeof leftValue === "number" && typeof rightValue === "number") {
      comparison = leftValue - rightValue;
    } else {
      comparison = compareStrings(String(leftValue), String(rightValue));
    }

    if (comparison === 0) {
      comparison = compareIsoDateTime(left.completedAtSortIso, right.completedAtSortIso);
    }
    if (comparison === 0) {
      comparison = compareStrings(left.pmName, right.pmName);
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

export const COMPLETED_PMS_SORT_COLUMNS: Array<{
  key: CompletedPmsSortColumn;
  label: string;
}> = [
  { key: "pmName", label: "PM name" },
  { key: "pmType", label: "PM type" },
  { key: "areaLabel", label: "Area / location" },
  { key: "frequency", label: "Frequency" },
  { key: "dueDate", label: "Scheduled due date" },
  { key: "completedAt", label: "Completed" },
  { key: "completedBy", label: "Completed by" },
  { key: "completionStatus", label: "Completion status" },
  { key: "cycleLabel", label: "Cycle / period" },
];

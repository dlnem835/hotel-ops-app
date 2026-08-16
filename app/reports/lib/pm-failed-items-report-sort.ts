import { PM_FREQUENCY_ORDER } from "@/app/maintenance/lib/pm-types";
import type { PmReportFailedItemRow } from "@/app/reports/lib/pm-report-types";
import type { PmReportSortDirection } from "@/app/reports/lib/pm-completed-report-sort";

export type FailedPmItemsSortColumn =
  | "itemLabel"
  | "sourcePmName"
  | "pmType"
  | "areaLabel"
  | "frequency"
  | "completedBy"
  | "completedAt"
  | "notes";

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
  row: PmReportFailedItemRow,
  column: FailedPmItemsSortColumn
): string | number {
  switch (column) {
    case "itemLabel":
      return row.itemLabel;
    case "sourcePmName":
      return row.sourcePmName;
    case "pmType":
      return PM_FREQUENCY_ORDER[row.pmTypeKey];
    case "areaLabel":
      return row.areaLabel;
    case "frequency":
      return PM_FREQUENCY_ORDER[row.pmTypeKey];
    case "completedBy":
      return row.completedBy;
    case "completedAt":
      return row.completedAtSortIso;
    case "notes":
      return row.notes;
    default:
      return "";
  }
}

export function sortFailedPmItemReportRows(
  rows: PmReportFailedItemRow[],
  column: FailedPmItemsSortColumn,
  direction: PmReportSortDirection
): PmReportFailedItemRow[] {
  const sorted = [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, column);
    const rightValue = getSortValue(right, column);

    let comparison = 0;
    if (column === "completedAt") {
      comparison = compareIsoDateTime(String(leftValue), String(rightValue));
    } else if (typeof leftValue === "number" && typeof rightValue === "number") {
      comparison = leftValue - rightValue;
    } else {
      comparison = compareStrings(String(leftValue), String(rightValue));
    }

    if (comparison === 0) {
      comparison = compareStrings(left.itemLabel, right.itemLabel);
    }
    if (comparison === 0) {
      comparison = compareStrings(left.sourcePmName, right.sourcePmName);
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

export const FAILED_PM_ITEMS_SORT_COLUMNS: Array<{
  key: FailedPmItemsSortColumn;
  label: string;
}> = [
  { key: "itemLabel", label: "Failed item" },
  { key: "sourcePmName", label: "Source PM" },
  { key: "pmType", label: "PM type" },
  { key: "areaLabel", label: "Area / location" },
  { key: "frequency", label: "Frequency" },
  { key: "completedBy", label: "Completed by" },
  { key: "completedAt", label: "Completed" },
  { key: "notes", label: "Comments" },
];

export function getFailedItemStepKey(row: PmReportFailedItemRow): string | null {
  const separatorIndex = row.id.indexOf("::");
  if (separatorIndex === -1) return null;
  const stepKey = row.id.slice(separatorIndex + 2) || null;
  // Target-level Fail rows are assignment failures, not checklist-step keys.
  if (stepKey === "target") return null;
  return stepKey;
}

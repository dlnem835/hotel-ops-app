import type { WorkOrderReportRow } from "@/app/reports/lib/work-order-report-types";
import { resolveWorkOrderReportCreatedByLabel } from "@/app/reports/lib/work-order-report-types";

export type AllWorkOrdersSortColumn =
  | "title"
  | "area"
  | "category"
  | "priority"
  | "status"
  | "createdBy"
  | "created"
  | "source"
  | "completedBy"
  | "completed"
  | "comments";

export type AllWorkOrdersSortDirection = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = {
  Urgent: 0,
  Important: 1,
  Normal: 2,
};

const STATUS_ORDER: Record<string, number> = {
  Open: 0,
  "In Progress": 1,
  Completed: 2,
  Cancelled: 3,
};

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function getCreatedBySortValue(row: WorkOrderReportRow): string {
  return resolveWorkOrderReportCreatedByLabel({
    createdByDisplayName: row.createdBy,
  });
}

function getSortValue(row: WorkOrderReportRow, column: AllWorkOrdersSortColumn): string | number {
  switch (column) {
    case "title":
      return row.title;
    case "area":
      return row.area;
    case "category":
      return row.category;
    case "priority":
      return PRIORITY_ORDER[row.priority] ?? 99;
    case "status":
      return STATUS_ORDER[row.status] ?? 99;
    case "createdBy":
      return getCreatedBySortValue(row);
    case "created":
      return row.createdAtIso || row.createdAt;
    case "source":
      return row.source;
    case "completedBy":
      return row.completedBy ?? "";
    case "completed":
      return row.completedAtIso ?? row.completedAt ?? "";
    case "comments":
      return row.comments;
    default:
      return "";
  }
}

export function sortAllWorkOrdersReportRows(
  rows: WorkOrderReportRow[],
  column: AllWorkOrdersSortColumn,
  direction: AllWorkOrdersSortDirection
): WorkOrderReportRow[] {
  const sorted = [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, column);
    const rightValue = getSortValue(right, column);

    let comparison = 0;
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      comparison = leftValue - rightValue;
    } else {
      comparison = compareStrings(String(leftValue), String(rightValue));
    }

    if (comparison === 0) {
      comparison = compareStrings(left.title, right.title);
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

export const ALL_WORK_ORDERS_SORT_COLUMNS: Array<{
  key: AllWorkOrdersSortColumn;
  label: string;
}> = [
  { key: "title", label: "Title" },
  { key: "area", label: "Room / Area" },
  { key: "category", label: "Category" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "createdBy", label: "Created by" },
  { key: "created", label: "Created" },
  { key: "source", label: "Source" },
  { key: "completedBy", label: "Completed by" },
  { key: "completed", label: "Completed" },
  { key: "comments", label: "Comments" },
];

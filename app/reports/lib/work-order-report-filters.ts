import type { WorkOrderReportFilters } from "@/app/reports/lib/report-definitions";
import { WORK_ORDER_SOURCE_FILTER_OPTIONS } from "@/app/reports/lib/report-definitions";
import {  matchesWorkOrderReportSourceFilter,
  type WorkOrderReportBySourceRow,
  type WorkOrderReportGroupRow,
  type WorkOrderReportRow,
  type WorkOrderReportSource,
} from "@/app/reports/lib/work-order-report-types";
function matchesDateRange(
  dateIso: string | null | undefined,
  dateStart: string,
  dateEnd: string
): boolean {
  if (!dateStart && !dateEnd) return true;
  if (!dateIso) return false;

  if (dateStart && dateIso < dateStart) return false;
  if (dateEnd && dateIso > dateEnd) return false;
  return true;
}

function matchesReportStatus(
  rowStatus: string,
  filterStatus: WorkOrderReportFilters["status"]
): boolean {
  if (filterStatus === "All") return true;
  if (filterStatus === "Open") {
    return rowStatus === "Open" || rowStatus === "In Progress";
  }
  if (filterStatus === "Completed") return rowStatus === "Completed";
  return rowStatus === filterStatus;
}

function matchesCategory(rowCategory: string, filterCategory: string): boolean {
  if (filterCategory === "All") return true;
  return rowCategory === filterCategory;
}

function matchesItemIssue(rowItemIssue: string, filterItemIssue: string): boolean {
  if (filterItemIssue === "All") return true;
  return rowItemIssue === filterItemIssue;
}

function matchesArea(row: WorkOrderReportRow, filters: WorkOrderReportFilters): boolean {
  if (filters.areaId != null) {
    return row.areaId === filters.areaId;
  }

  if (!filters.areaLabel || filters.areaLabel === "All") {
    return true;
  }

  return row.area === filters.areaLabel;
}

function matchesSharedWorkOrderReportFilters(
  row: WorkOrderReportRow,
  filters: WorkOrderReportFilters,
  dateIso: string | null | undefined
): boolean {
  const search = filters.search.trim().toLowerCase();
  if (
    search &&
    ![
      row.id,
      row.title,
      row.description,
      row.area,
      row.category,
      row.itemIssue,
      row.createdBy,
      row.assignedTo,
      row.completedBy,
      row.resolution,
    ].some((value) => String(value || "").toLowerCase().includes(search))
  ) {
    return false;
  }
  if (
    filters.completedBy !== "All" &&
    row.completedBy !== filters.completedBy
  ) {
    return false;
  }
  if (!matchesReportStatus(row.status, filters.status)) return false;
  if (!matchesWorkOrderReportSourceFilter(row.source, filters.source)) return false;
  if (!matchesCategory(row.category, filters.category)) return false;
  if (!matchesItemIssue(row.itemIssue, filters.itemIssue)) return false;
  if (!matchesArea(row, filters)) return false;
  if (!matchesDateRange(dateIso, filters.dateStart, filters.dateEnd)) return false;
  return true;
}

/** Completed-only Resolution Report, filtered by completion date. */
export function filterWorkOrdersForResolutionReport(
  rows: WorkOrderReportRow[],
  filters: WorkOrderReportFilters
): WorkOrderReportRow[] {
  return rows.filter((row) => {
    if (row.status !== "Completed") return false;
    return matchesSharedWorkOrderReportFilters(
      row,
      { ...filters, status: "Completed" },
      row.completedAtIso
    );
  });
}

/** Applies Work Orders report filters for list and aggregate reports. */
export function filterWorkOrdersForReport(
  rows: WorkOrderReportRow[],
  filters: WorkOrderReportFilters,
  options?: { dateField?: "created" | "completed" }
): WorkOrderReportRow[] {
  const dateField = options?.dateField ?? "created";

  return rows.filter((row) => {
    const dateIso = dateField === "completed" ? row.completedAtIso : row.createdAtIso;
    return matchesSharedWorkOrderReportFilters(row, filters, dateIso);
  });
}

/** Applies Work Orders report filters for the Average Completion Time report. */
export function filterWorkOrdersForAverageCompletionTimeReport(
  rows: WorkOrderReportRow[],
  filters: WorkOrderReportFilters
): WorkOrderReportRow[] {
  return rows.filter((row) => {
    if (filters.status === "Open" || row.status !== "Completed") {
      return false;
    }

    if (!matchesCategory(row.category, filters.category)) return false;
    if (!matchesItemIssue(row.itemIssue, filters.itemIssue)) return false;
    if (!matchesArea(row, filters)) return false;
    if (!matchesWorkOrderReportSourceFilter(row.source, filters.source)) return false;
    if (!matchesDateRange(row.completedAtIso, filters.dateStart, filters.dateEnd)) {
      return false;
    }

    return true;
  });
}

export function calculateAverageCompletionTimeHours(
  rows: WorkOrderReportRow[]
): number | null {
  const completedRows = rows.filter(
    (row) => row.status === "Completed" && row.hoursOpen != null
  );

  if (completedRows.length === 0) return null;

  const totalHours = completedRows.reduce(
    (sum, row) => sum + (row.hoursOpen ?? 0),
    0
  );

  return totalHours / completedRows.length;
}

export function formatAverageCompletionTime(hours: number | null): string {
  if (hours == null) return "—";

  const roundedTotalHours = Math.round(hours);
  const days = Math.floor(roundedTotalHours / 24);
  const remainingHours = roundedTotalHours % 24;

  if (days === 0) {
    return `${remainingHours} hour${remainingHours === 1 ? "" : "s"}`;
  }

  if (remainingHours === 0) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  return `${days} day${days === 1 ? "" : "s"} ${remainingHours} hour${
    remainingHours === 1 ? "" : "s"
  }`;
}

function isOpenStatus(status: string): boolean {
  return status === "Open" || status === "In Progress";
}

export function buildWorkOrdersBySourceRows(
  rows: WorkOrderReportRow[]
): WorkOrderReportBySourceRow[] {
  const sourceLabels = WORK_ORDER_SOURCE_FILTER_OPTIONS.filter(
    (source): source is WorkOrderReportSource => source !== "All"
  );

  return sourceLabels
    .map((source) => {
      const group = rows.filter((row) => row.source === source);
      if (group.length === 0) return null;

      const completed = group.filter((row) => row.status === "Completed");
      const avgHours = calculateAverageCompletionTimeHours(completed);
      const avgDays =
        completed.length > 0
          ? completed.reduce((sum, row) => sum + (row.daysOpen ?? 0), 0) / completed.length
          : 0;

      return {
        source,
        total: group.length,
        open: group.filter((row) => isOpenStatus(row.status)).length,
        completed: completed.length,
        avgCompletionTime: formatAverageCompletionTime(avgHours),
        avgDaysOpen: Math.round(avgDays * 10) / 10,
      };
    })
    .filter((row): row is WorkOrderReportBySourceRow => row != null);
}

export function buildWorkOrdersByCategoryRows(
  rows: WorkOrderReportRow[]
): WorkOrderReportGroupRow[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildWorkOrdersByItemIssueRows(
  rows: WorkOrderReportRow[]
): WorkOrderReportGroupRow[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.itemIssue, (counts.get(row.itemIssue) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildWorkOrdersByAreaRows(rows: WorkOrderReportRow[]): WorkOrderReportGroupRow[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.area, (counts.get(row.area) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

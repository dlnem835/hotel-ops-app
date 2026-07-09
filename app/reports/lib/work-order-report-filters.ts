import type { WorkOrderReportFilters } from "@/app/reports/lib/report-definitions";
import type { WorkOrderReportRow } from "@/app/reports/lib/work-order-report-types";

function matchesDateRange(
  completedAtIso: string | null | undefined,
  dateStart: string,
  dateEnd: string
): boolean {
  if (!dateStart && !dateEnd) return true;
  if (!completedAtIso) return false;

  if (dateStart && completedAtIso < dateStart) return false;
  if (dateEnd && completedAtIso > dateEnd) return false;
  return true;
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

    if (filters.category !== "All" && row.category !== filters.category) {
      return false;
    }

    if (
      filters.areaLabel &&
      filters.areaLabel !== "All" &&
      row.area !== filters.areaLabel
    ) {
      return false;
    }

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

import type { ReportPdfTable } from "@/app/reports/lib/extract-report-print-content";
import type {
  InspectionFailedItemGroupRow,
  InspectionFailedSectionGroupRow,
} from "@/app/reports/lib/inspection-report-types";
import {
  FAILED_AREAS_DETAIL_SORT_COLUMNS,
  FAILED_ITEMS_DETAIL_SORT_COLUMNS,
} from "@/app/reports/lib/inspection-report-sort";

export const REPORT_PDF_EMPTY_MESSAGE = "No report results matched the selected filters.";

export function buildEmptyReportPdfTables(): ReportPdfTable[] {
  return [
    {
      headers: ["Results"],
      rows: [[REPORT_PDF_EMPTY_MESSAGE]],
    },
  ];
}

export function formatGroupedPdfSectionTitle(label: string, count: number | string): string {
  return `${label}    Failures: ${count}`;
}

function formatScore(score: number | null): string {
  if (score === null) return "—";
  return `${score}%`;
}

function buildFailedOccurrencePdfRows(
  items: InspectionFailedItemGroupRow["items"] | InspectionFailedSectionGroupRow["items"]
): string[][] {
  return items.map((item) => [
    item.sectionLabel,
    item.roomNumber,
    item.inspectorName,
    item.associateName,
    formatScore(item.scorePercent),
    item.completedAt,
    item.notes,
  ]);
}

/** Matches grouped Failed Items report rows shown in the in-app report + Download PDF export. */
export function buildInspectionFailedItemPdfTables(
  groups: InspectionFailedItemGroupRow[]
): ReportPdfTable[] {
  if (groups.length === 0) {
    return buildEmptyReportPdfTables();
  }

  const headers = FAILED_ITEMS_DETAIL_SORT_COLUMNS.map((column) => column.label);

  return groups.map((group) => ({
    title: formatGroupedPdfSectionTitle(group.displayLabel, group.totalFailures),
    headers,
    rows: buildFailedOccurrencePdfRows(group.items),
  }));
}

/** Matches grouped Failed Sections report rows shown in the in-app report + Download PDF export. */
export function buildInspectionFailedSectionPdfTables(
  groups: InspectionFailedSectionGroupRow[]
): ReportPdfTable[] {
  if (groups.length === 0) {
    return buildEmptyReportPdfTables();
  }

  const headers = FAILED_AREAS_DETAIL_SORT_COLUMNS.map((column) => column.label);

  return groups.map((group) => ({
    title: formatGroupedPdfSectionTitle(group.sectionLabel, group.totalFailures),
    headers,
    rows: group.items.map((item) => [
      item.itemLabel,
      item.roomNumber,
      item.inspectorName,
      item.associateName,
      formatScore(item.scorePercent),
      item.completedAt,
      item.notes,
    ]),
  }));
}

export function countReportPdfRows(tables: ReportPdfTable[]): number {
  return tables.reduce((sum, table) => sum + table.rows.length, 0);
}

export function hasOnlyEmptyReportPdfMessage(tables: ReportPdfTable[]): boolean {
  return (
    tables.length === 1 &&
    tables[0]?.headers.length === 1 &&
    tables[0]?.headers[0] === "Results" &&
    tables[0]?.rows.length === 1 &&
    tables[0]?.rows[0]?.[0] === REPORT_PDF_EMPTY_MESSAGE
  );
}

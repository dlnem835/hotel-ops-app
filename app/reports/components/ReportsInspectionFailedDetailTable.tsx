"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { InspectionFailedOccurrenceDetailRow } from "@/app/reports/lib/inspection-report-types";
import type {
  FailedAreasDetailSortColumn,
  FailedItemsDetailSortColumn,
  InspectionReportSortDirection,
} from "@/app/reports/lib/inspection-report-sort";
import {
  FAILED_AREAS_DETAIL_SORT_COLUMNS,
  FAILED_ITEMS_DETAIL_SORT_COLUMNS,
} from "@/app/reports/lib/inspection-report-sort";

type SortableHeaderProps<T extends string> = {
  column: { key: T; label: string };
  sortColumn: T;
  sortDirection: InspectionReportSortDirection;
  onSort: (column: T) => void;
};

function SortableHeader<T extends string>({
  column,
  sortColumn,
  sortDirection,
  onSort,
}: SortableHeaderProps<T>) {
  const isActive = sortColumn === column.key;
  return (
    <th scope="col">
      <button
        type="button"
        className="reports-all-work-orders__sort-btn"
        onClick={() => onSort(column.key)}
        aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{column.label}</span>
        {isActive ? (
          sortDirection === "asc" ? (
            <ChevronUp size={14} className="reports-all-work-orders__sort-icon" aria-hidden />
          ) : (
            <ChevronDown size={14} className="reports-all-work-orders__sort-icon" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );
}

function formatScore(score: number | null): string {
  if (score === null) return "—";
  return `${score}%`;
}

type ReportsInspectionFailedDetailTableProps =
  | {
      variant: "areas";
      rows: InspectionFailedOccurrenceDetailRow[];
      sortColumn: FailedAreasDetailSortColumn;
      sortDirection: InspectionReportSortDirection;
      onSort: (column: FailedAreasDetailSortColumn) => void;
      openingSessionId: number | null;
      onOpenSession: (sessionId: number, highlightKey: string) => void;
    }
  | {
      variant: "items";
      rows: InspectionFailedOccurrenceDetailRow[];
      sortColumn: FailedItemsDetailSortColumn;
      sortDirection: InspectionReportSortDirection;
      onSort: (column: FailedItemsDetailSortColumn) => void;
      openingSessionId: number | null;
      onOpenSession: (sessionId: number, highlightKey: string) => void;
    };

export default function ReportsInspectionFailedDetailTable(
  props: ReportsInspectionFailedDetailTableProps
) {
  if (props.variant === "areas") {
    return (
      <div className="reports-pm-results__table-wrap">
        <table className="reports-pm-results__table reports-wo-top-categories__table">
          <thead>
            <tr>
              {FAILED_AREAS_DETAIL_SORT_COLUMNS.map((column) => (
                <SortableHeader
                  key={column.key}
                  column={column}
                  sortColumn={props.sortColumn}
                  sortDirection={props.sortDirection}
                  onSort={props.onSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <tr key={`${row.sessionId}-${row.categoryKey}-${row.itemKey}`}>
                <td>{row.itemLabel}</td>
                <td>
                  <button
                    type="button"
                    className="reports-pm-results__source-link"
                    onClick={() =>
                      props.onOpenSession(row.sessionId, `${row.categoryKey}::${row.itemKey}`)
                    }
                    disabled={Boolean(props.openingSessionId)}
                  >
                    {row.roomNumber}
                  </button>
                </td>
                <td>{row.inspectorName}</td>
                <td>{row.associateName}</td>
                <td>{formatScore(row.scorePercent)}</td>
                <td>{row.completedAt}</td>
                <td>{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="reports-pm-results__table-wrap">
      <table className="reports-pm-results__table reports-wo-top-categories__table">
        <thead>
          <tr>
            {FAILED_ITEMS_DETAIL_SORT_COLUMNS.map((column) => (
              <SortableHeader
                key={column.key}
                column={column}
                sortColumn={props.sortColumn}
                sortDirection={props.sortDirection}
                onSort={props.onSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={`${row.sessionId}-${row.categoryKey}-${row.itemKey}`}>
              <td>{row.sectionLabel}</td>
              <td>
                <button
                  type="button"
                  className="reports-pm-results__source-link"
                  onClick={() =>
                    props.onOpenSession(row.sessionId, `${row.categoryKey}::${row.itemKey}`)
                  }
                  disabled={Boolean(props.openingSessionId)}
                >
                  {row.roomNumber}
                </button>
              </td>
              <td>{row.inspectorName}</td>
              <td>{row.associateName}</td>
              <td>{formatScore(row.scorePercent)}</td>
              <td>{row.completedAt}</td>
              <td>{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

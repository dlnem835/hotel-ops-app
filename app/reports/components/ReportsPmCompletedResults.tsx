"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  COMPLETED_PMS_SORT_COLUMNS,
  sortCompletedPmReportRows,
  type CompletedPmsSortColumn,
  type PmReportSortDirection,
} from "@/app/reports/lib/pm-completed-report-sort";
import type { PmReportCompletedRow } from "@/app/reports/lib/pm-report-types";

type ReportsPmCompletedResultsProps = {
  rows: PmReportCompletedRow[];
};

export default function ReportsPmCompletedResults({ rows }: ReportsPmCompletedResultsProps) {
  const [sortColumn, setSortColumn] = useState<CompletedPmsSortColumn>("completedAt");
  const [sortDirection, setSortDirection] = useState<PmReportSortDirection>("desc");

  const sortedRows = useMemo(
    () => sortCompletedPmReportRows(rows, sortColumn, sortDirection),
    [rows, sortColumn, sortDirection]
  );

  function handleSort(column: CompletedPmsSortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  }

  return (
    <div className="reports-pm-results reports-pm-completed-results">
      <p className="reports-pm-results__lead">Completed PMs matching the selected filters.</p>
      <div className="reports-pm-results__table-wrap">
        <table className="reports-pm-results__table">
          <thead>
            <tr>
              {COMPLETED_PMS_SORT_COLUMNS.map((column) => {
                const isActive = sortColumn === column.key;

                return (
                  <th key={column.key} scope="col">
                    <button
                      type="button"
                      className="reports-all-work-orders__sort-btn"
                      onClick={() => handleSort(column.key)}
                      aria-sort={
                        isActive
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <span>{column.label}</span>
                      {isActive ? (
                        sortDirection === "asc" ? (
                          <ChevronUp
                            size={14}
                            className="reports-all-work-orders__sort-icon"
                            aria-hidden
                          />
                        ) : (
                          <ChevronDown
                            size={14}
                            className="reports-all-work-orders__sort-icon"
                            aria-hidden
                          />
                        )
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length > 0 ? (
              sortedRows.map((row) => (
                <tr key={row.occurrenceId}>
                  <td>{row.pmName}</td>
                  <td>{row.pmType}</td>
                  <td>{row.areaLabel}</td>
                  <td>{row.frequency}</td>
                  <td>{row.dueDate}</td>
                  <td>{row.completedAt}</td>
                  <td>{row.completedBy}</td>
                  <td>{row.completionStatusLabel}</td>
                  <td>{row.cycleLabel}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9}>No completed PMs match the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

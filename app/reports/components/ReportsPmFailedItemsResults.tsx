"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ReportsPmOccurrenceDetailModal from "@/app/reports/components/ReportsPmOccurrenceDetailModal";
import {
  FAILED_PM_ITEMS_SORT_COLUMNS,
  getFailedItemStepKey,
  sortFailedPmItemReportRows,
  type FailedPmItemsSortColumn,
} from "@/app/reports/lib/pm-failed-items-report-sort";
import type { PmReportSortDirection } from "@/app/reports/lib/pm-completed-report-sort";
import type { PmReportFailedItemRow } from "@/app/reports/lib/pm-report-types";

type ReportsPmFailedItemsResultsProps = {
  rows: PmReportFailedItemRow[];
};

type SelectedPmOccurrence = {
  occurrenceId: number;
  highlightStepKey: string | null;
};

function getScrollContainer(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;

  while (node) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY)) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

export default function ReportsPmFailedItemsResults({ rows }: ReportsPmFailedItemsResultsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const [sortColumn, setSortColumn] = useState<FailedPmItemsSortColumn>("completedAt");
  const [sortDirection, setSortDirection] = useState<PmReportSortDirection>("desc");
  const [selectedOccurrence, setSelectedOccurrence] = useState<SelectedPmOccurrence | null>(
    null
  );
  const [openingOccurrenceId, setOpeningOccurrenceId] = useState<number | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const sortedRows = useMemo(
    () => sortFailedPmItemReportRows(rows, sortColumn, sortDirection),
    [rows, sortColumn, sortDirection]
  );

  useEffect(() => {
    if (selectedOccurrence) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    window.requestAnimationFrame(() => {
      container.scrollTop = savedScrollTopRef.current;
    });
  }, [selectedOccurrence]);

  function handleSort(column: FailedPmItemsSortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  }

  async function handleOpenPmRecord(row: PmReportFailedItemRow) {
    if (openingOccurrenceId) return;

    scrollContainerRef.current = getScrollContainer(rootRef.current);
    savedScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;

    setOpenError(null);
    setOpeningOccurrenceId(row.occurrenceId);

    try {
      const response = await fetch(`/api/maintenance/pm-occurrences/${row.occurrenceId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to open PM record.");
      }

      setSelectedOccurrence({
        occurrenceId: row.occurrenceId,
        highlightStepKey: getFailedItemStepKey(row),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to open PM record.";
      setOpenError(message);
    } finally {
      setOpeningOccurrenceId(null);
    }
  }

  function handleClosePmRecord() {
    setSelectedOccurrence(null);
  }

  return (
    <>
      <div ref={rootRef} className="reports-pm-results reports-pm-failed-items-results">
        <p className="reports-pm-results__lead">
          Failed checklist items from completed PMs matching the selected filters.
        </p>
        <p className="reports-pm-results__lead">
          Total failed items: <strong>{rows.length}</strong>
        </p>
        {openError ? (
          <p className="reports-all-work-orders__error" role="alert">
            {openError}
          </p>
        ) : null}
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                {FAILED_PM_ITEMS_SORT_COLUMNS.map((column) => {
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
                sortedRows.map((row) => {
                  const isOpening = openingOccurrenceId === row.occurrenceId;

                  return (
                    <tr key={row.id}>
                      <td>{row.itemLabel}</td>
                      <td>
                        <button
                          type="button"
                          className="reports-pm-results__source-link"
                          onClick={() => void handleOpenPmRecord(row)}
                          disabled={Boolean(openingOccurrenceId)}
                          aria-busy={isOpening}
                        >
                          {row.sourcePmName}
                        </button>
                      </td>
                      <td>{row.pmType}</td>
                      <td>{row.areaLabel}</td>
                      <td>{row.frequency}</td>
                      <td>{row.completedBy}</td>
                      <td>{row.completedAt}</td>
                      <td>{row.notes}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8}>No failed PM items match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOccurrence ? (
        <ReportsPmOccurrenceDetailModal
          occurrenceId={selectedOccurrence.occurrenceId}
          highlightStepKey={selectedOccurrence.highlightStepKey}
          onClose={handleClosePmRecord}
        />
      ) : null}
    </>
  );
}

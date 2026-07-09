"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_WORK_ORDER_REPORT_FILTERS,
  type WorkOrderReportFilters,
  type WorkOrderReportId,
} from "@/app/reports/lib/report-definitions";
import { fetchWorkOrderReportSource } from "@/app/reports/lib/work-order-report-data";
import {
  buildWorkOrdersByAreaRows,
  buildWorkOrdersByCategoryRows,
  buildWorkOrdersBySourceRows,
  calculateAverageCompletionTimeHours,
  filterWorkOrdersForAverageCompletionTimeReport,
  filterWorkOrdersForReport,
  formatAverageCompletionTime,
} from "@/app/reports/lib/work-order-report-filters";
import { resolveWorkOrderReportCreatedByLabel } from "@/app/reports/lib/work-order-report-types";
import type { WorkOrderReportRow } from "@/app/reports/lib/work-order-report-types";

type ReportsWoPlaceholderResultsProps = {
  reportId: WorkOrderReportId;
  filters?: WorkOrderReportFilters;
};

export default function ReportsWoPlaceholderResults({
  reportId,
  filters,
}: ReportsWoPlaceholderResultsProps) {
  const [items, setItems] = useState<WorkOrderReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFilters = filters ?? DEFAULT_WORK_ORDER_REPORT_FILTERS;

  useEffect(() => {
    let cancelled = false;

    async function loadReportData() {
      setLoading(true);
      setError(null);

      try {
        const rows = await fetchWorkOrderReportSource();
        if (!cancelled) {
          setItems(rows);
        }
      } catch (loadError) {
        if (cancelled) return;
        const message =
          loadError instanceof Error ? loadError.message : "Unable to load work order data.";
        setError(message);
        setItems([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadReportData();

    return () => {
      cancelled = true;
    };
  }, [reportId, filters]);

  const filteredItems = useMemo(
    () => filterWorkOrdersForReport(items, activeFilters),
    [items, activeFilters]
  );
  const bySourceRows = useMemo(
    () => buildWorkOrdersBySourceRows(filteredItems),
    [filteredItems]
  );
  const byCategoryRows = useMemo(
    () => buildWorkOrdersByCategoryRows(filteredItems),
    [filteredItems]
  );
  const byAreaRows = useMemo(
    () => buildWorkOrdersByAreaRows(filteredItems),
    [filteredItems]
  );
  const completedRows = useMemo(
    () => filterWorkOrdersForAverageCompletionTimeReport(items, activeFilters),
    [items, activeFilters]
  );
  const averageHours = useMemo(
    () => calculateAverageCompletionTimeHours(completedRows),
    [completedRows]
  );
  const averageCompletionTime = formatAverageCompletionTime(averageHours);

  if (loading) {
    return <ReportStateMessage message="Loading work order report data…" />;
  }

  if (error) {
    return <ReportStateMessage message={error} />;
  }

  if (reportId === "work-orders-by-source") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">
          Work orders grouped by source matching the selected filters.
        </p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Total Work Orders</th>
                <th>Open</th>
                <th>Completed</th>
                <th>Average Completion Time</th>
                <th>Average Days Open</th>
              </tr>
            </thead>
            <tbody>
              {bySourceRows.length > 0 ? (
                bySourceRows.map((row) => (
                  <tr key={row.source}>
                    <td>{row.source}</td>
                    <td>{row.total}</td>
                    <td>{row.open}</td>
                    <td>{row.completed}</td>
                    <td>{row.avgCompletionTime}</td>
                    <td>{row.avgDaysOpen} days</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>No work orders match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === "work-orders-by-category") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">
          Top work order categories matching the selected filters.
        </p>
        <div className="reports-wo-group-list">
          {byCategoryRows.length > 0 ? (
            byCategoryRows.map((row) => (
              <div key={row.label} className="reports-wo-group-row">
                <span className="reports-wo-group-row__label">{row.label}</span>
                <span className="reports-wo-group-row__count">{row.count}</span>
              </div>
            ))
          ) : (
            <p className="reports-pm-results__lead">No work orders match the selected filters.</p>
          )}
        </div>
      </div>
    );
  }

  if (reportId === "work-orders-by-area") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">
          Top work order areas matching the selected filters.
        </p>
        <div className="reports-wo-group-list">
          {byAreaRows.length > 0 ? (
            byAreaRows.map((row) => (
              <div key={row.label} className="reports-wo-group-row">
                <span className="reports-wo-group-row__label">{row.label}</span>
                <span className="reports-wo-group-row__count">{row.count}</span>
              </div>
            ))
          ) : (
            <p className="reports-pm-results__lead">No work orders match the selected filters.</p>
          )}
        </div>
      </div>
    );
  }

  if (reportId === "work-order-completion-time") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">
          Completed work orders matching the selected filters.
        </p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>Work order</th>
                <th>Created</th>
                <th>Completed</th>
                <th>Time open</th>
                <th>Completed by</th>
              </tr>
            </thead>
            <tbody>
              {completedRows.length > 0 ? (
                completedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>{row.createdAt}</td>
                    <td>{row.completedAt}</td>
                    <td>
                      {row.daysOpen ?? "—"} days ({row.hoursOpen ?? "—"} hrs)
                    </td>
                    <td>{row.completedBy ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No completed work orders match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="reports-wo-summary-grid" style={{ marginTop: "16px" }}>
          <div className="reports-wo-summary-card reports-wo-summary-card--wide">
            <span className="reports-wo-summary-card__label">Average Completion Time</span>
            <span className="reports-wo-summary-card__value">{averageCompletionTime}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-wo-results">
      <p className="reports-pm-results__lead">
        All work orders matching the selected filters.
      </p>
      <div className="reports-pm-results__table-wrap reports-wo-results__table-wrap--wide">
        <table className="reports-pm-results__table reports-wo-results__table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Room / Area</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Created by</th>
              <th>Created</th>
              <th>Source</th>
              <th>Completed by</th>
              <th>Completed</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length > 0 ? (
              filteredItems.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.area}</td>
                  <td>{row.category}</td>
                  <td>{row.priority}</td>
                  <td>{row.status}</td>
                  <td>
                    {resolveWorkOrderReportCreatedByLabel({
                      createdByDisplayName: row.createdBy,
                    })}
                  </td>
                  <td>{row.createdAt}</td>
                  <td>{row.source}</td>
                  <td>{row.completedBy ?? "—"}</td>
                  <td>{row.completedAt ?? "—"}</td>
                  <td>{row.comments}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11}>No work orders match the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportStateMessage({ message }: { message: string }) {
  return (
    <div className="reports-wo-results">
      <p className="reports-pm-results__lead">{message}</p>
    </div>
  );
}

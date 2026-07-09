import {
  DEFAULT_WORK_ORDER_REPORT_FILTERS,
  type WorkOrderReportFilters,
  type WorkOrderReportId,
} from "@/app/reports/lib/report-definitions";
import {
  calculateAverageCompletionTimeHours,
  filterWorkOrdersForAverageCompletionTimeReport,
  formatAverageCompletionTime,
} from "@/app/reports/lib/work-order-report-filters";
import { resolveWorkOrderReportCreatedByLabel } from "@/app/reports/lib/work-order-report-types";
import {
  SAMPLE_WO_BY_AREA,
  SAMPLE_WO_BY_CATEGORY,
  SAMPLE_WO_BY_SOURCE,
  SAMPLE_WORK_ORDER_ROWS,
} from "@/app/reports/lib/work-order-report-sample-data";

const SAMPLE_PREVIEW_LEAD =
  "Sample preview — live report data will appear after backend integration.";

type ReportsWoPlaceholderResultsProps = {
  reportId: WorkOrderReportId;
  filters?: WorkOrderReportFilters;
};

export default function ReportsWoPlaceholderResults({
  reportId,
  filters,
}: ReportsWoPlaceholderResultsProps) {  if (reportId === "work-orders-by-source") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">{SAMPLE_PREVIEW_LEAD}</p>
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
              {SAMPLE_WO_BY_SOURCE.map((row) => (
                <tr key={row.source}>
                  <td>{row.source}</td>
                  <td>{row.total}</td>
                  <td>{row.open}</td>
                  <td>{row.completed}</td>
                  <td>{row.avgCompletionTime}</td>
                  <td>{row.avgDaysOpen} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === "work-orders-by-category") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">{SAMPLE_PREVIEW_LEAD}</p>
        <div className="reports-wo-group-list">
          {SAMPLE_WO_BY_CATEGORY.map((row) => (
            <div key={row.category} className="reports-wo-group-row">
              <span className="reports-wo-group-row__label">{row.category}</span>
              <span className="reports-wo-group-row__count">{row.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (reportId === "work-orders-by-area") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">{SAMPLE_PREVIEW_LEAD}</p>
        <div className="reports-wo-group-list">
          {SAMPLE_WO_BY_AREA.map((row) => (
            <div key={row.area} className="reports-wo-group-row">
              <span className="reports-wo-group-row__label">{row.area}</span>
              <span className="reports-wo-group-row__count">{row.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (reportId === "work-order-completion-time") {
    const activeFilters = filters ?? DEFAULT_WORK_ORDER_REPORT_FILTERS;
    const completedRows = filterWorkOrdersForAverageCompletionTimeReport(
      SAMPLE_WORK_ORDER_ROWS,
      activeFilters
    );
    const averageHours = calculateAverageCompletionTimeHours(completedRows);
    const averageCompletionTime = formatAverageCompletionTime(averageHours);

    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">{SAMPLE_PREVIEW_LEAD}</p>
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
                      {row.daysOpen} days ({row.hoursOpen} hrs)
                    </td>
                    <td>{row.completedBy}</td>
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
      <p className="reports-pm-results__lead">{SAMPLE_PREVIEW_LEAD}</p>
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
            {SAMPLE_WORK_ORDER_ROWS.map((row) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

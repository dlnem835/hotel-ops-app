import type { WorkOrderReportId } from "@/app/reports/lib/report-definitions";
import {
  SAMPLE_WO_BY_AREA,
  SAMPLE_WO_BY_CATEGORY,
  SAMPLE_WORK_ORDER_ROWS,
} from "@/app/reports/lib/work-order-report-sample-data";

type ReportsWoPlaceholderResultsProps = {
  reportId: WorkOrderReportId;
};

export default function ReportsWoPlaceholderResults({
  reportId,
}: ReportsWoPlaceholderResultsProps) {
  if (reportId === "days-open") {
    const openRows = SAMPLE_WORK_ORDER_ROWS.filter((row) => row.status === "Open");
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">Sample preview — open work orders with days open.</p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>Work order</th>
                <th>Room / Area</th>
                <th>Priority</th>
                <th>Opened</th>
                <th>Days open</th>
              </tr>
            </thead>
            <tbody>
              {openRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.area}</td>
                  <td>{row.priority}</td>
                  <td>{row.createdAt}</td>
                  <td>{row.daysOpen ?? "—"}</td>
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
        <p className="reports-pm-results__lead">Sample preview — work orders grouped by category.</p>
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
        <p className="reports-pm-results__lead">Sample preview — work orders grouped by room / area.</p>
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
    const completedRows = SAMPLE_WORK_ORDER_ROWS.filter((row) => row.status === "Completed");
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">
          Sample preview — completed work orders with time-to-close.
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
              {completedRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.createdAt}</td>
                  <td>{row.completedAt}</td>
                  <td>
                    {row.daysOpen} days ({row.hoursOpen} hrs)
                  </td>
                  <td>{row.completedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-wo-results">
      <p className="reports-pm-results__lead">Sample preview — all work orders matching filters.</p>
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
                <td>{row.createdBy}</td>
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

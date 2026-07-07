import type { InspectionModuleReportId, InspectionReportModalTarget } from "@/app/reports/lib/report-definitions";
import {
  getInspectionReportLabels,
  SAMPLE_ASSOCIATE_RANKING,
  SAMPLE_AVERAGE_TIME_DETAILS,
  SAMPLE_ROOMS_DONE,
  SAMPLE_ROOMS_NOT_DONE,
  SAMPLE_SCORES_BY_ROOM,
  SAMPLE_TOP_FAILED_ITEMS,
  SAMPLE_TOP_FAILED_SECTIONS,
} from "@/app/reports/lib/inspection-report-sample-data";

type ReportsInspectionPlaceholderResultsProps = {
  target: InspectionReportModalTarget;
};

export default function ReportsInspectionPlaceholderResults({
  target,
}: ReportsInspectionPlaceholderResultsProps) {
  const { reportId, variant } = target;
  const labels = getInspectionReportLabels(variant);

  if (reportId === "associate-ranking") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">
          Sample preview — associates ranked by score and {labels.roomsDoneColumn.toLowerCase()}.
        </p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>Associate</th>
                <th>{labels.roomsDoneColumn}</th>
                <th>{labels.roomsDonePercentColumn}</th>
                <th>Inspections</th>
                <th>Average score</th>
                <th>Failed items</th>
                <th>Avg time</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ASSOCIATE_RANKING.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{row.roomsCount}</td>
                  <td>{row.roomsPercent}%</td>
                  <td>{row.inspections}</td>
                  <td>{row.averageScore}%</td>
                  <td>{row.failedItems}</td>
                  <td>{row.averageTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === "average-time") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">
          Sample preview — durations calculated from completed_at minus started_at.
        </p>
        {SAMPLE_AVERAGE_TIME_DETAILS.map((inspector) => (
          <div key={inspector.inspector} className="reports-inspection-time-block">
            <div className="reports-inspection-time-block__header">
              <span className="reports-inspection-time-block__name">{inspector.inspector}</span>
              <span className="reports-inspection-time-block__average">
                Average {inspector.averageTime}
              </span>
            </div>
            <ul className="reports-inspection-time-block__list">
              {inspector.inspections.map((entry) => (
                <li key={`${inspector.inspector}-${entry.room}`}>
                  <span>{entry.room}</span>
                  <span>{entry.duration ?? "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (reportId === "top-failed-sections") {
    return (
      <GroupedCountResults
        lead="Sample preview — failed items grouped by section."
        labelHeader="Section"
        rows={SAMPLE_TOP_FAILED_SECTIONS.map((row) => ({
          label: row.section,
          count: row.count,
        }))}
      />
    );
  }

  if (reportId === "top-failed-items") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">Sample preview — most frequently failed items.</p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Section</th>
                <th>Fail count</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_TOP_FAILED_ITEMS.map((row) => (
                <tr key={row.item}>
                  <td>{row.item}</td>
                  <td>{row.section}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === "rooms-not-done") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">{labels.roomsNotDoneLead}</p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Last {variant === "rpm" ? "RPM" : "inspection"}</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROOMS_NOT_DONE.map((row) => (
                <tr key={row.room}>
                  <td>{row.room}</td>
                  <td>{row.lastCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === "rooms-done") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">{labels.roomsDoneLead}</p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>Room</th>
                <th>{labels.typeLabel}</th>
                <th>{variant === "rpm" ? "Associate" : "Inspector"}</th>
                <th>Score</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROOMS_DONE.map((row) => (
                <tr key={`${row.room}-${row.completedAt}`}>
                  <td>{row.room}</td>
                  <td>{row.type}</td>
                  <td>{row.inspector}</td>
                  <td>{row.score}%</td>
                  <td>{row.completedAt}</td>
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
      <p className="reports-pm-results__lead">Sample preview — scores by room for the selected period.</p>
      <div className="reports-pm-results__table-wrap">
        <table className="reports-pm-results__table">
          <thead>
            <tr>
              <th>Room</th>
              <th>{labels.typeLabel}</th>
              <th>Latest score</th>
              <th>Average score</th>
              <th>Failed items</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_SCORES_BY_ROOM.map((row) => (
              <tr key={row.room}>
                <td>{row.room}</td>
                <td>{row.type}</td>
                <td>{row.latestScore}%</td>
                <td>{row.averageScore}%</td>
                <td>{row.failedItems}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupedCountResults({
  lead,
  labelHeader,
  rows,
}: {
  lead: string;
  labelHeader: string;
  rows: Array<{ label: string; count: number }>;
}) {
  return (
    <div className="reports-wo-results">
      <p className="reports-pm-results__lead">{lead}</p>
      <div className="reports-wo-group-list">
        {rows.map((row) => (
          <div key={row.label} className="reports-wo-group-row">
            <span className="reports-wo-group-row__label">{row.label}</span>
            <span className="reports-wo-group-row__count">{row.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { PmReportId } from "@/app/reports/lib/report-definitions";

type ReportsPmPlaceholderResultsProps = {
  reportId: PmReportId;
};

const PM_REPORT_FREQUENCY_GROUPS = [
  {
    frequency: "Monthly",
    items: [
      { name: "Fire Extinguishers", completed: 6, total: 12, periods: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12"] },
      { name: "Emergency Lighting", completed: 4, total: 12, periods: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12"] },
    ],
  },
  {
    frequency: "Quarterly",
    items: [
      { name: "Boiler Inspection", completed: 2, total: 4, periods: ["Q1", "Q2", "Q3", "Q4"] },
      { name: "Elevator PM", completed: 3, total: 4, periods: ["Q1", "Q2", "Q3", "Q4"] },
    ],
  },
  {
    frequency: "Annual",
    items: [
      { name: "Roof Inspection", completed: 1, total: 1, periods: ["P1"] },
    ],
  },
];

const FAILED_PM_ITEM_SAMPLES = [
  {
    item: "Grease trap — drain flow below standard",
    sourcePm: "Kitchen Exhaust — Monthly PM",
    sourcePmId: "pm-sample-1042",
    date: "Jun 12, 2026",
  },
  {
    item: "Pool chemical log — missing signature",
    sourcePm: "Pool Equipment — Weekly PM",
    sourcePmId: "pm-sample-0988",
    date: "Jun 8, 2026",
  },
  {
    item: "Generator load test — voltage out of range",
    sourcePm: "Emergency Generator — Quarterly PM",
    sourcePmId: "pm-sample-0751",
    date: "May 29, 2026",
  },
];

export default function ReportsPmPlaceholderResults({
  reportId,
}: ReportsPmPlaceholderResultsProps) {
  if (reportId === "failed-pm-items") {
    return (
      <div className="reports-pm-results">
        <p className="reports-pm-results__lead">
          Sample preview — failed checklist items with source PM reference.
        </p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>Failed item</th>
                <th>Source PM</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {FAILED_PM_ITEM_SAMPLES.map((row) => (
                <tr key={row.sourcePmId}>
                  <td>{row.item}</td>
                  <td>
                    <button type="button" className="reports-pm-results__source-link">
                      {row.sourcePm}
                    </button>
                  </td>
                  <td>{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === "pm-report") {
    return (
      <div className="reports-pm-results">
        <p className="reports-pm-results__lead">
          Sample preview — PM progress grouped by frequency with period markers.
        </p>
        {PM_REPORT_FREQUENCY_GROUPS.map((group) => (
          <div key={group.frequency} className="reports-pm-results__frequency-group">
            <h4 className="reports-pm-results__frequency-title">{group.frequency}</h4>
            <ul className="reports-pm-results__progress-list">
              {group.items.map((item) => (
                <li key={item.name} className="reports-pm-results__progress-item">
                  <div className="reports-pm-results__progress-header">
                    <span className="reports-pm-results__progress-name">{item.name}</span>
                    <span className="reports-pm-results__progress-count">
                      {item.completed} of {item.total} completed
                    </span>
                  </div>
                  <div className="reports-pm-results__period-row">
                    {item.periods.map((period, index) => {
                      const completed = index < item.completed;
                      return (
                        <span
                          key={period}
                          className={
                            completed
                              ? "reports-pm-results__period reports-pm-results__period--completed"
                              : "reports-pm-results__period reports-pm-results__period--missed"
                          }
                          title={completed ? `${period} completed` : `${period} missed`}
                        >
                          {period}
                        </span>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  const label =
    reportId === "completed-pms"
      ? "completed PM"
      : reportId === "missed-pms"
        ? "missed PM"
        : "PM";

  return (
    <div className="reports-pm-results">
      <p className="reports-pm-results__lead">
        Sample preview — {label} results will appear here after backend integration.
      </p>
      <div className="reports-pm-results__table-wrap">
        <table className="reports-pm-results__table">
          <thead>
            <tr>
              <th>PM name</th>
              <th>Type</th>
              <th>Due date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>HVAC Filter Change — Tower A</td>
              <td>Monthly</td>
              <td>Jun 1, 2026</td>
              <td>{reportId === "missed-pms" ? "Missed" : "Completed"}</td>
            </tr>
            <tr>
              <td>Pool Chemical Balance</td>
              <td>Weekly</td>
              <td>Jun 10, 2026</td>
              <td>{reportId === "missed-pms" ? "Missed" : "Completed"}</td>
            </tr>
            <tr>
              <td>Fire Pump Test</td>
              <td>Quarterly</td>
              <td>Jun 15, 2026</td>
              <td>{reportId === "missed-pms" ? "Missed" : "Completed"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

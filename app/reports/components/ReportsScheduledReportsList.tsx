"use client";

import { useEffect, useState } from "react";
import {
  deleteReportSchedule,
  listSavedReportSchedules,
} from "@/app/reports/lib/report-schedule-storage";
import { formatScheduleSummary } from "@/app/reports/lib/report-schedule-types";
import type { SavedReportSchedule } from "@/app/reports/lib/report-schedule-types";

export default function ReportsScheduledReportsList() {
  const [schedules, setSchedules] = useState<SavedReportSchedule[]>([]);

  useEffect(() => {
    function refresh() {
      setSchedules(listSavedReportSchedules());
    }

    refresh();
    window.addEventListener("report-schedules-updated", refresh);
    return () => window.removeEventListener("report-schedules-updated", refresh);
  }, []);

  function handleDelete(id: string) {
    setSchedules(deleteReportSchedule(id));
  }

  if (schedules.length === 0) {
    return (
      <div className="reports-empty-tab">
        <h2 className="reports-empty-tab__title">Scheduled</h2>
        <p className="reports-empty-tab__description">
          Saved recurring report schedules will appear here after you use Schedule from any
          report results area.
        </p>
      </div>
    );
  }

  return (
    <div className="reports-scheduled-list">
      <p className="reports-pm-results__lead">
        Saved schedules remember each report&apos;s filters. Email delivery is not enabled yet.
      </p>
      <div className="reports-pm-results__table-wrap">
        <table className="reports-pm-results__table">
          <thead>
            <tr>
              <th>Report</th>
              <th>Property</th>
              <th>Schedule</th>
              <th>Recipients</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {schedules.map((item) => (
              <tr key={item.id}>
                <td>{item.schedule.reportName}</td>
                <td>{item.schedule.property}</td>
                <td>{formatScheduleSummary(item.schedule)}</td>
                <td>{item.schedule.recipients || "—"}</td>
                <td>{item.schedule.active ? "Active" : "Paused"}</td>
                <td>
                  <button
                    type="button"
                    className="reports-pm-results__source-link"
                    onClick={() => handleDelete(item.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

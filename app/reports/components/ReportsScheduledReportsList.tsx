"use client";

import { useEffect, useState } from "react";
import {
  deleteReportSchedule,
  listSavedReportSchedules,
  REPORT_SCHEDULES_UPDATED_EVENT,
  sendScheduledReportTest,
} from "@/app/reports/lib/report-schedule-storage";
import { formatScheduleSummary } from "@/app/reports/lib/report-schedule-types";
import type { SavedReportSchedule } from "@/app/reports/lib/report-schedule-types";

function formatScheduleTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ReportsScheduledReportsList() {
  const [schedules, setSchedules] = useState<SavedReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSavedReportSchedules();
      setSchedules(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load schedules.");
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    window.addEventListener(REPORT_SCHEDULES_UPDATED_EVENT, () => {
      void refresh();
    });
    return () => window.removeEventListener(REPORT_SCHEDULES_UPDATED_EVENT, () => undefined);
  }, []);

  async function handleDelete(id: string) {
    try {
      await deleteReportSchedule(id);
      setActionMessage("Schedule removed.");
      await refresh();
    } catch (deleteError) {
      setActionMessage(
        deleteError instanceof Error ? deleteError.message : "Unable to remove schedule."
      );
    }
  }

  async function handleSendTest(id: string) {
    setTestingId(id);
    setActionMessage(null);
    try {
      const result = await sendScheduledReportTest(id);
      if (!result.ok) {
        setActionMessage(result.error || "Send test failed.");
      } else {
        setActionMessage(
          result.resendMessageId
            ? `Test email sent. Resend message ID: ${result.resendMessageId}`
            : "Test email sent."
        );
      }
      await refresh();
    } catch (testError) {
      setActionMessage(testError instanceof Error ? testError.message : "Send test failed.");
    } finally {
      setTestingId(null);
    }
  }

  if (loading) {
    return <p className="reports-pm-results__lead">Loading scheduled reports…</p>;
  }

  if (error) {
    return (
      <p className="reports-all-work-orders__error" role="alert">
        {error}
      </p>
    );
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
        Saved schedules run automatically on the server and email the attached PDF to each
        recipient.
      </p>
      {actionMessage ? (
        <p className="reports-schedule-modal__save-message" role="status">
          {actionMessage}
        </p>
      ) : null}
      <div className="reports-pm-results__table-wrap">
        <table className="reports-pm-results__table">
          <thead>
            <tr>
              <th>Report</th>
              <th>Property</th>
              <th>Schedule</th>
              <th>Recipients</th>
              <th>Status</th>
              <th>Last sent</th>
              <th>Next send</th>
              <th>Last error</th>
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
                <td>
                  {!item.schedule.active
                    ? "Paused"
                    : item.lastStatus
                      ? item.lastStatus === "sent"
                        ? "Sent"
                        : "Failed"
                      : "Active"}
                </td>
                <td>{formatScheduleTimestamp(item.lastRunAt)}</td>
                <td>{formatScheduleTimestamp(item.nextRunAt)}</td>
                <td>{item.lastError || "—"}</td>
                <td>
                  <div className="reports-scheduled-list__actions">
                    <button
                      type="button"
                      className="reports-pm-results__source-link"
                      disabled={testingId === item.id}
                      onClick={() => void handleSendTest(item.id)}
                    >
                      {testingId === item.id ? "Sending…" : "Send Test Now"}
                    </button>
                    <button
                      type="button"
                      className="reports-pm-results__source-link"
                      onClick={() => void handleDelete(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

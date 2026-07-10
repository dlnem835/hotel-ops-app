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

type ScheduledReportTestFeedback = {
  status: "success" | "error";
  resendMessageId?: string | null;
  testSentAt?: string | null;
  error?: string | null;
};

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
  const [testFeedback, setTestFeedback] = useState<Record<string, ScheduledReportTestFeedback>>({});

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
      setTestFeedback((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      await refresh();
    } catch (deleteError) {
      setTestFeedback((current) => ({
        ...current,
        [id]: {
          status: "error",
          error:
            deleteError instanceof Error ? deleteError.message : "Unable to remove schedule.",
        },
      }));
    }
  }

  async function handleSendTest(id: string) {
    setTestingId(id);
    setTestFeedback((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });

    try {
      const result = await sendScheduledReportTest(id);
      if (!result.ok) {
        setTestFeedback((current) => ({
          ...current,
          [id]: {
            status: "error",
            error: result.error || "Resend failed",
          },
        }));
        return;
      }

      setTestFeedback((current) => ({
        ...current,
        [id]: {
          status: "success",
          resendMessageId: result.resendMessageId,
          testSentAt: result.testSentAt,
        },
      }));
    } catch (testError) {
      setTestFeedback((current) => ({
        ...current,
        [id]: {
          status: "error",
          error: testError instanceof Error ? testError.message : "Resend failed",
        },
      }));
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
        recipient. Use Send Test Now to run the same delivery pipeline immediately without
        changing the next scheduled send.
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
              <th>Last sent</th>
              <th>Next send</th>
              <th>Last error</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {schedules.map((item) => {
              const feedback = testFeedback[item.id];

              return (
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
                      {feedback?.status === "success" ? (
                        <div className="reports-scheduled-list__test-feedback reports-scheduled-list__test-feedback--success">
                          <p>Test sent successfully</p>
                          <p>Resend message ID: {feedback.resendMessageId || "—"}</p>
                          <p>{formatScheduleTimestamp(feedback.testSentAt)}</p>
                        </div>
                      ) : null}
                      {feedback?.status === "error" ? (
                        <p
                          className="reports-scheduled-list__test-feedback reports-scheduled-list__test-feedback--error"
                          role="alert"
                        >
                          {feedback.error}
                        </p>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

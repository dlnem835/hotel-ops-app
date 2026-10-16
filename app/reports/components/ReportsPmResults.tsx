"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pmSessionUrl } from "@/app/maintenance/lib/pm-session-return";
import ReportsPmCompletedResults from "@/app/reports/components/ReportsPmCompletedResults";
import ReportsPmFailedItemsResults from "@/app/reports/components/ReportsPmFailedItemsResults";
import type { PmReportFilters, PmReportId } from "@/app/reports/lib/report-definitions";
import { fetchPmReportSource } from "@/app/reports/lib/pm-report-data";
import { useReportTenantScope } from "@/app/reports/hooks/useReportTenantScope";
import { useTenantScopedReportSnapshot } from "@/app/reports/hooks/useTenantScopedReportSnapshot";
import {
  buildCompletedPmReportRows,
  buildFailedPmItemReportRows,
  buildMissedPmReportRows,
  buildPmCompletionOverviewReport,
} from "@/app/reports/lib/pm-report-filters";
import { getOverviewPeriodClassName } from "@/app/reports/lib/pm-report-overview-timing";

type ReportsPmResultsProps = {
  reportId: PmReportId;
  filters: PmReportFilters;
};

export default function ReportsPmResults({ reportId, filters }: ReportsPmResultsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [source, setSource] = useState<Awaited<ReturnType<typeof fetchPmReportSource>> | null>(
    null
  );
  const { scope, ready: tenantReady } = useReportTenantScope();
  const { belongsToCurrentScope, isCurrentRequest, markLoaded } =
    useTenantScopedReportSnapshot(scope);

  useEffect(() => {
    if (!tenantReady || !scope) {
      return;
    }

    const requestScope = scope;
    let cancelled = false;

    async function loadSource() {
      setLoading(true);
      setError(null);
      setSource(null);

      try {
        const data = await fetchPmReportSource(undefined, requestScope);
        if (cancelled || !isCurrentRequest(requestScope)) return;
        setSource(data);
        markLoaded(requestScope);
      } catch (loadError) {
        if (cancelled || !isCurrentRequest(requestScope)) return;
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load PM report data."
        );
        setSource(null);
        markLoaded(requestScope);
      } finally {
        if (!cancelled && isCurrentRequest(requestScope)) {
          setLoading(false);
        }
      }
    }

    void loadSource();

    return () => {
      cancelled = true;
    };
  }, [filters, reportId, reloadKey, tenantReady, scope, isCurrentRequest, markLoaded]);

  const scopedSource = useMemo(
    () => (belongsToCurrentScope ? source : null),
    [belongsToCurrentScope, source]
  );
  const completedRows = useMemo(
    () => (scopedSource ? buildCompletedPmReportRows(scopedSource, filters) : []),
    [scopedSource, filters]
  );
  const missedRows = useMemo(
    () => (scopedSource ? buildMissedPmReportRows(scopedSource, filters) : []),
    [scopedSource, filters]
  );
  const failedRows = useMemo(
    () => (scopedSource ? buildFailedPmItemReportRows(scopedSource, filters) : []),
    [scopedSource, filters]
  );
  const overview = useMemo(
    () => (scopedSource ? buildPmCompletionOverviewReport(scopedSource, filters) : null),
    [scopedSource, filters]
  );

  function openPmRecord(occurrenceId: number | null) {
    if (!occurrenceId) return;
    router.push(pmSessionUrl(occurrenceId));
  }

  if (loading || !belongsToCurrentScope) {
    return <ReportStateMessage message="Loading preventive maintenance report data…" />;
  }

  if (error) {
    return (
      <ReportStateMessage
        message={error}
        actionLabel="Retry"
        onAction={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  if (reportId === "failed-pm-items") {
    return <ReportsPmFailedItemsResults rows={failedRows} />;
  }
  if (reportId === "pm-report") {
    const groups = overview?.groups ?? [];
    const summary = overview?.summary;

    return (
      <div className="reports-pm-results">
        <p className="reports-pm-results__lead">
          PM completion overview for the selected date range and filters.
        </p>
        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.frequency} className="reports-pm-results__frequency-group">
              <h4 className="reports-pm-results__frequency-title">{group.frequency}</h4>
              <ul className="reports-pm-results__progress-list">
                {group.items.map((item) => (
                  <li
                    key={`${group.frequency}-${item.pmName}-${item.areaLabel}`}
                    className="reports-pm-results__progress-item"
                  >
                    <div className="reports-pm-results__progress-header">
                      <span className="reports-pm-results__progress-name">
                        {item.pmName}
                        <span className="reports-pm-results__progress-area">
                          {" "}
                          — {item.areaLabel}
                        </span>
                      </span>
                      <span className="reports-pm-results__progress-count">
                        {item.completedCount} of {item.expectedCycles} completed (
                        {item.completionPercent}%)
                      </span>
                    </div>
                    <div className="reports-pm-results__progress-stats">
                      <span>On time: {item.completedOnTimeCount}</span>
                      <span>Before next due: {item.completedBeforeNextDueCount}</span>
                      <span>Missed: {item.missedCount}</span>
                    </div>
                    <div className="reports-pm-results__period-row">
                      {item.periods.map((period) => (
                        <span
                          key={`${item.pmName}-${period.label}`}
                          className={getOverviewPeriodClassName(period.status)}
                          title={`${period.label}: ${period.title}`}
                        >
                          {period.label}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="reports-pm-results__lead">No PM cycles match the selected filters.</p>
        )}
        {summary ? (
          <div className="reports-pm-results__overview-summary">
            <h4 className="reports-pm-results__frequency-title">Summary totals</h4>
            <ul className="reports-pm-results__summary-list">
              <li>Total scheduled PM cycles: {summary.totalScheduledCycles}</li>
              <li>Completed on time: {summary.completedOnTime}</li>
              <li>Completed before next due date: {summary.completedBeforeNextDue}</li>
              <li>Missed: {summary.missed}</li>
              <li>Overall completion percentage: {summary.overallCompletionPercent}%</li>
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (reportId === "missed-pms") {
    return (
      <div className="reports-pm-results">
        <p className="reports-pm-results__lead">
          Missed PMs after the 7-day grace period matching the selected filters.
        </p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>PM name</th>
                <th>PM type</th>
                <th>Area / location</th>
                <th>Frequency</th>
                <th>Original due date</th>
                <th>Grace-period expiration</th>
                <th>Days missed</th>
                <th>Cycle / period</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {missedRows.length > 0 ? (
                missedRows.map((row) => (
                  <tr key={`${row.pmName}-${row.dueDateIso}-${row.areaLabel}`}>
                    <td>
                      {row.occurrenceId ? (
                        <button
                          type="button"
                          className="reports-pm-results__source-link"
                          onClick={() => openPmRecord(row.occurrenceId)}
                        >
                          {row.pmName}
                        </button>
                      ) : (
                        row.pmName
                      )}
                    </td>
                    <td>{row.pmType}</td>
                    <td>{row.areaLabel}</td>
                    <td>{row.frequency}</td>
                    <td>{row.dueDate}</td>
                    <td>{row.graceExpiresAt}</td>
                    <td>{row.daysMissed}</td>
                    <td>{row.cycleLabel}</td>
                    <td>{row.statusLabel}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>No missed PMs match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === "completed-pms") {
    return <ReportsPmCompletedResults rows={completedRows} />;
  }

  return null;
}

function ReportStateMessage({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="reports-pm-results">
      <p className="reports-pm-results__lead">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="reports-pm-results__source-link"
          onClick={onAction}
          style={{ marginTop: "8px" }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

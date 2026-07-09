"use client";

import { useState } from "react";
import {
  DEFAULT_PASS_ON_UNREAD_REPORT_FILTERS,
  type PassOnReportId,
  type PassOnUnreadReportFilters,
} from "@/app/reports/lib/report-definitions";
import {
  filterPassOnUnreadByUserRows,
  filterPassOnUnreadEntriesForAssociate,
} from "@/app/reports/lib/pass-on-report-filters";
import {
  SAMPLE_PASS_ON_ROWS,
  SAMPLE_PASS_ON_UNREAD_BY_USER_ROWS,
  SAMPLE_PASS_ON_UNREAD_ENTRIES,
} from "@/app/reports/lib/pass-on-report-sample-data";

type ReportsPassOnPlaceholderResultsProps = {
  reportId: PassOnReportId;
  unreadFilters?: PassOnUnreadReportFilters;
};

export default function ReportsPassOnPlaceholderResults({
  reportId,
  unreadFilters,
}: ReportsPassOnPlaceholderResultsProps) {
  const [selectedAssociate, setSelectedAssociate] = useState<string | null>(null);

  if (reportId === "unread-entries-by-user") {
    const activeFilters = unreadFilters ?? DEFAULT_PASS_ON_UNREAD_REPORT_FILTERS;
    const rows = filterPassOnUnreadByUserRows(
      SAMPLE_PASS_ON_UNREAD_BY_USER_ROWS,
      activeFilters
    );
    const unreadEntries =
      selectedAssociate == null
        ? []
        : filterPassOnUnreadEntriesForAssociate(
            SAMPLE_PASS_ON_UNREAD_ENTRIES,
            selectedAssociate,
            activeFilters
          );

    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">
          Sample preview — associates sorted by highest unread pass-on count first.
        </p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>Associate name</th>
                <th>Department</th>
                <th>Total entries</th>
                <th>Entries read</th>
                <th>Entries unread</th>
                <th>Read %</th>
                <th>Last entry read</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.associateName}>
                    <td>
                      <button
                        type="button"
                        className="reports-pm-results__source-link"
                        onClick={() =>
                          setSelectedAssociate((current) =>
                            current === row.associateName ? null : row.associateName
                          )
                        }
                      >
                        {row.associateName}
                      </button>
                    </td>
                    <td>{row.department}</td>
                    <td>{row.totalEntries}</td>
                    <td>{row.entriesRead}</td>
                    <td>{row.entriesUnread}</td>
                    <td>{row.readPercent}%</td>
                    <td>{row.lastEntryReadAt}</td>
                    <td>{row.lastLoginAt ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>No associates match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedAssociate ? (
          <div style={{ marginTop: "16px" }}>
            <p className="reports-pm-results__lead">
              Unread pass-on entries for {selectedAssociate} — sample drill-down preview.
            </p>
            <TableResults
              lead=""
              headers={["Shift", "Excerpt", "Posted"]}
              rows={unreadEntries.map((entry) => [
                entry.shift,
                entry.excerpt,
                entry.postedAt,
              ])}
              emptyMessage="No unread entries for this associate in the selected date range."
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (reportId === "entries-by-associate") {
    return (
      <GroupedResults
        lead="Sample preview — pass-on entries grouped by associate."
        groups={[
          { label: "J. Martinez", count: 12 },
          { label: "Front Desk", count: 18 },
          { label: "D. Chen", count: 9 },
        ]}
      />
    );
  }

  if (reportId === "edited-entries") {
    const edited = SAMPLE_PASS_ON_ROWS.filter((row) => row.edited);
    return (
      <TableResults
        lead="Sample preview — edited pass-on entries."
        headers={["Associate", "Shift", "Excerpt", "Updated"]}
        rows={edited.map((row) => [row.associate, row.shift, row.excerpt, row.date])}
      />
    );
  }

  return null;
}

function GroupedResults({
  lead,
  groups,
}: {
  lead: string;
  groups: Array<{ label: string; count: number }>;
}) {
  return (
    <div className="reports-wo-results">
      <p className="reports-pm-results__lead">{lead}</p>
      <div className="reports-wo-group-list">
        {groups.map((group) => (
          <div key={group.label} className="reports-wo-group-row">
            <span className="reports-wo-group-row__label">{group.label}</span>
            <span className="reports-wo-group-row__count">{group.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableResults({
  lead,
  headers,
  rows,
  emptyMessage,
}: {
  lead: string;
  headers: string[];
  rows: string[][];
  emptyMessage?: string;
}) {
  return (
    <div className="reports-wo-results">
      {lead ? <p className="reports-pm-results__lead">{lead}</p> : null}
      <div className="reports-pm-results__table-wrap">
        <table className="reports-pm-results__table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length}>{emptyMessage ?? "No results to display."}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

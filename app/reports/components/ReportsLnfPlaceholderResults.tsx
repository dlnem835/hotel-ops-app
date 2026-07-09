"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS,
  DEFAULT_LOST_FOUND_REPORT_FILTERS,
  type LostFoundFoundByReportFilters,
  type LostFoundReportFilters,
  type LostFoundReportId,
} from "@/app/reports/lib/report-definitions";
import {
  buildLostFoundFoundByRows,
  createReportsSupabaseClient,
  fetchLostFoundReportSource,
} from "@/app/reports/lib/lost-found-report-data";
import {
  filterLostFoundAllItemsReportRows,
  filterLostFoundAgingReportRows,
  filterLostFoundFoundByReportRows,
  filterLostFoundItemsForAssociateDrillDown,
  filterLostFoundItemsForFoundByReport,
  filterLostFoundShippingReportRows,
} from "@/app/reports/lib/lost-found-report-filters";
import type {
  LostFoundFoundByRow,
  LostFoundReportItem,
} from "@/app/reports/lib/lost-found-report-types";
import type { TeamMemberRow } from "@/app/reports/lib/lost-found-report-data";

type ReportsLnfPlaceholderResultsProps = {
  reportId: LostFoundReportId;
  filters?: LostFoundReportFilters;
  foundByFilters?: LostFoundFoundByReportFilters;
};

export default function ReportsLnfPlaceholderResults({
  reportId,
  filters,
  foundByFilters,
}: ReportsLnfPlaceholderResultsProps) {
  const [selectedAssociate, setSelectedAssociate] = useState<string | null>(null);
  const [items, setItems] = useState<LostFoundReportItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedAssociate(null);
  }, [reportId, filters, foundByFilters]);

  useEffect(() => {
    let cancelled = false;

    async function loadReportData() {
      setLoading(true);
      setError(null);

      try {
        const supabase = createReportsSupabaseClient();
        const source = await fetchLostFoundReportSource(supabase);
        if (cancelled) return;

        setItems(source.items);
        setTeamMembers(source.teamMembers);
      } catch (loadError) {
        if (cancelled) return;
        const message =
          loadError instanceof Error ? loadError.message : "Unable to load Lost & Found data.";
        setError(message);
        setItems([]);
        setTeamMembers([]);
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
  }, [reportId, filters, foundByFilters]);

  const activeAllItemsFilters = filters ?? DEFAULT_LOST_FOUND_REPORT_FILTERS;
  const activeFoundByFilters = foundByFilters ?? DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS;
  const sharedFilters = filters ?? DEFAULT_LOST_FOUND_REPORT_FILTERS;

  const allItems = useMemo(
    () => filterLostFoundAllItemsReportRows(items, activeAllItemsFilters),
    [items, activeAllItemsFilters]
  );
  const foundBySourceItems = useMemo(
    () => filterLostFoundItemsForFoundByReport(items, activeFoundByFilters),
    [items, activeFoundByFilters]
  );

  const foundByRows = useMemo(
    () => buildLostFoundFoundByRows(foundBySourceItems, teamMembers),
    [foundBySourceItems, teamMembers]
  );

  const foundByReportRows = useMemo(
    () => filterLostFoundFoundByReportRows(foundByRows, activeFoundByFilters),
    [foundByRows, activeFoundByFilters]
  );
  const shippingItems = useMemo(
    () => filterLostFoundShippingReportRows(items, sharedFilters),
    [items, sharedFilters]
  );
  const agingItems = useMemo(
    () => filterLostFoundAgingReportRows(items, sharedFilters),
    [items, sharedFilters]
  );
  const selectedAssociateItems = useMemo(
    () =>
      selectedAssociate == null
        ? []
        : filterLostFoundItemsForAssociateDrillDown(
            items,
            selectedAssociate,
            activeFoundByFilters
          ),
    [items, selectedAssociate, activeFoundByFilters]
  );

  if (loading) {
    return <ReportStateMessage message="Loading Lost & Found report data…" />;
  }

  if (error) {
    return <ReportStateMessage message={error} />;
  }

  if (reportId === "all-items") {
    return (
      <ItemTable
        lead="All Lost & Found items matching the selected filters."
        headers={["Guest", "Room", "Item", "Status", "Found by", "Created by", "Created"]}
        rows={allItems.map((item) => [
          item.guestLastName,
          item.roomNumber,
          item.itemName,
          item.status,
          item.foundBy,
          item.createdBy,
          item.createdAt,
        ])}
        emptyMessage="No items match the selected filters."
      />
    );
  }

  if (reportId === "found-by") {
    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">
          Associates who turned in lost items during the selected date range.
        </p>
        <div className="reports-pm-results__table-wrap">
          <table className="reports-pm-results__table">
            <thead>
              <tr>
                <th>Associate name</th>
                <th>Items found</th>
                <th>Last item found</th>
                <th>Most recent item</th>
                <th>Last found location</th>
              </tr>
            </thead>
            <tbody>
              {foundByReportRows.length > 0 ? (
                foundByReportRows.map((row) => (
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
                    <td>{row.itemsFound}</td>
                    <td>{row.lastItemFoundDate}</td>
                    <td>{row.mostRecentItem}</td>
                    <td>{row.lastFoundLocation}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No associates match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedAssociate ? (
          <div style={{ marginTop: "16px" }}>
            <p className="reports-pm-results__lead">
              Items turned in by {selectedAssociate} during the selected date range.
            </p>
            <ItemTable
              lead=""
              headers={["Item", "Location", "Guest", "Status", "Found"]}
              rows={selectedAssociateItems.map((item) => [
                item.itemName,
                item.roomNumber,
                item.guestLastName,
                item.status,
                item.createdAt,
              ])}
              emptyMessage="No items for this associate in the selected date range."
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (reportId === "shipped-items") {
    return (
      <ItemTable
        lead="Shipped Lost & Found items matching the selected filters."
        headers={["Guest", "Room", "Item", "Shipped", "Found by"]}
        rows={shippingItems.map((item) => [
          item.guestLastName,
          item.roomNumber,
          item.itemName,
          item.shippedAt ?? "—",
          item.foundBy,
        ])}
        emptyMessage="No shipped items match the selected filters."
      />
    );
  }

  return (
    <ItemTable
      lead="Stored items past the 6-month retention period."
      headers={["Guest", "Room", "Item", "Created", "Days stored", "Status", "Found by"]}
      rows={agingItems.map((item) => [
        item.guestLastName,
        item.roomNumber,
        item.itemName,
        item.createdAt,
        String(item.daysStored ?? "—"),
        item.status,
        item.foundBy,
      ])}
      emptyMessage="No aging items match the selected filters."
    />
  );
}

function ReportStateMessage({ message }: { message: string }) {
  return (
    <div className="reports-wo-results">
      <p className="reports-pm-results__lead">{message}</p>
    </div>
  );
}

function ItemTable({
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

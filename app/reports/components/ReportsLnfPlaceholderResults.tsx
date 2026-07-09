"use client";

import { useState } from "react";
import {
  DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS,
  DEFAULT_LOST_FOUND_REPORT_FILTERS,
  type LostFoundFoundByReportFilters,
  type LostFoundReportFilters,
  type LostFoundReportId,
} from "@/app/reports/lib/report-definitions";
import {
  filterLostFoundAllItemsReportRows,
  filterLostFoundFoundByReportRows,
  filterLostFoundItemsForAssociateDrillDown,
} from "@/app/reports/lib/lost-found-report-filters";
import {
  SAMPLE_LOST_FOUND_ITEMS,
  SAMPLE_LNF_FOUND_BY_ROWS,
} from "@/app/reports/lib/lost-found-report-sample-data";

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

  if (reportId === "all-items") {
    const activeFilters = filters ?? DEFAULT_LOST_FOUND_REPORT_FILTERS;
    const items = filterLostFoundAllItemsReportRows(SAMPLE_LOST_FOUND_ITEMS, activeFilters);

    return (
      <ItemTable
        lead="Sample preview — all Lost & Found items matching the selected filters."
        headers={["Guest", "Room", "Item", "Status", "Found by", "Created by", "Created"]}
        rows={items.map((item) => [
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
    const activeFilters = foundByFilters ?? DEFAULT_LOST_FOUND_FOUND_BY_REPORT_FILTERS;
    const rows = filterLostFoundFoundByReportRows(SAMPLE_LNF_FOUND_BY_ROWS, activeFilters);
    const selectedAssociateItems =
      selectedAssociate == null
        ? []
        : filterLostFoundItemsForAssociateDrillDown(
            SAMPLE_LOST_FOUND_ITEMS,
            selectedAssociate,
            activeFilters
          );

    return (
      <div className="reports-wo-results">
        <p className="reports-pm-results__lead">
          Sample preview — associates who turned in lost items during the selected date range.
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
              Items turned in by {selectedAssociate} during the selected date range — sample
              drill-down preview.
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
    const items = SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Shipped");
    return (
      <ItemTable
        lead="Sample preview — shipped items."
        headers={["Guest", "Room", "Item", "Shipped", "Found by"]}
        rows={items.map((item) => [
          item.guestLastName,
          item.roomNumber,
          item.itemName,
          item.shippedAt ?? "—",
          item.foundBy,
        ])}
      />
    );
  }

  const items = SAMPLE_LOST_FOUND_ITEMS.filter(
    (item) => (item.daysStored ?? 0) >= 180 && item.status === "Stored"
  );
  return (
    <ItemTable
      lead="Sample preview — aging items past retention period."
      headers={["Guest", "Room", "Item", "Created", "Days stored", "Status", "Found by"]}
      rows={items.map((item) => [
        item.guestLastName,
        item.roomNumber,
        item.itemName,
        item.createdAt,
        String(item.daysStored ?? "—"),
        item.status,
        item.foundBy,
      ])}
    />
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

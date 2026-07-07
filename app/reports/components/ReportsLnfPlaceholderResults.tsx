import type { LostFoundReportId } from "@/app/reports/lib/report-definitions";
import { SAMPLE_LOST_FOUND_ITEMS } from "@/app/reports/lib/lost-found-report-sample-data";

type ReportsLnfPlaceholderResultsProps = {
  reportId: LostFoundReportId;
};

const ACTIVE_STATUSES = new Set(["Stored", "Label sent", "Ready to be shipped"]);

export default function ReportsLnfPlaceholderResults({
  reportId,
}: ReportsLnfPlaceholderResultsProps) {
  if (reportId === "all-items") {
    const items = SAMPLE_LOST_FOUND_ITEMS.filter((item) => ACTIVE_STATUSES.has(item.status));
    return (
      <ItemTable
        lead="Sample preview — active Lost & Found items."
        headers={["Guest", "Room", "Item", "Status", "Created"]}
        rows={items.map((item) => [
          item.guestLastName,
          item.roomNumber,
          item.itemName,
          item.status,
          item.createdAt,
        ])}
      />
    );
  }

  if (reportId === "closed-items") {
    const items = SAMPLE_LOST_FOUND_ITEMS.filter(
      (item) => item.closedAt || item.status === "Discarded" || item.status === "Guest Declined"
    );
    return (
      <ItemTable
        lead="Sample preview — closed items."
        headers={["Guest", "Room", "Item", "Closed", "Closed by", "Reason"]}
        rows={items.map((item) => [
          item.guestLastName,
          item.roomNumber,
          item.itemName,
          item.closedAt ?? "—",
          item.closedBy ?? "—",
          item.closureReason ?? item.status,
        ])}
      />
    );
  }

  if (reportId === "shipped-items") {
    const items = SAMPLE_LOST_FOUND_ITEMS.filter((item) => item.status === "Shipped");
    return (
      <ItemTable
        lead="Sample preview — shipped items."
        headers={["Guest", "Room", "Item", "Shipped", "Updated by"]}
        rows={items.map((item) => [
          item.guestLastName,
          item.roomNumber,
          item.itemName,
          item.shippedAt ?? "—",
          item.updatedBy ?? "—",
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
      headers={["Guest", "Room", "Item", "Created", "Days stored", "Status"]}
      rows={items.map((item) => [
        item.guestLastName,
        item.roomNumber,
        item.itemName,
        item.createdAt,
        String(item.daysStored ?? "—"),
        item.status,
      ])}
    />
  );
}

function ItemTable({
  lead,
  headers,
  rows,
}: {
  lead: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="reports-wo-results">
      <p className="reports-pm-results__lead">{lead}</p>
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
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

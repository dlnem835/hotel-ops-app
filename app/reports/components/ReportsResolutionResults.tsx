"use client";

import { useState } from "react";
import DashboardWorkOrderDetailModal from "@/app/dashboard/components/DashboardWorkOrderDetailModal";
import type { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import type { WorkOrderReportRow } from "@/app/reports/lib/work-order-report-types";

type ReportsResolutionResultsProps = {
  rows: WorkOrderReportRow[];
};

function formatElapsed(hours: number | null): string {
  if (hours == null) return "—";
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (!days) return `${remainingHours} hr${remainingHours === 1 ? "" : "s"}`;
  if (!remainingHours) return `${days} day${days === 1 ? "" : "s"}`;
  return `${days} day${days === 1 ? "" : "s"} ${remainingHours} hr${
    remainingHours === 1 ? "" : "s"
  }`;
}

export default function ReportsResolutionResults({
  rows,
}: ReportsResolutionResultsProps) {
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  async function openWorkOrder(id: string) {
    if (openingId) return;
    setOpeningId(id);
    setOpenError(null);
    try {
      const response = await tenantFetch(`/api/work-orders/${id}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to open work order.");
      }
      setSelectedWorkOrder(result.workOrder as WorkOrder);
    } catch (error) {
      setOpenError(
        error instanceof Error ? error.message : "Unable to open work order."
      );
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <>
      <div className="reports-wo-results reports-all-work-orders">
        <p className="reports-pm-results__lead">
          Completed work orders and their recorded resolutions.
        </p>
        {openError ? (
          <p className="reports-all-work-orders__error" role="alert">
            {openError}
          </p>
        ) : null}
        <div className="reports-pm-results__table-wrap reports-wo-results__table-wrap--wide">
          <table className="reports-pm-results__table reports-wo-results__table reports-all-work-orders__table">
            <thead>
              <tr>
                <th>Work Order</th>
                <th>Original Issue</th>
                <th>Location / Room / Area</th>
                <th>Item / Issue</th>
                <th>Priority</th>
                <th>Created</th>
                <th>Created By</th>
                <th>Assigned To</th>
                <th>Completed</th>
                <th>Resolution</th>
                <th>Completed By</th>
                <th>Completion Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        type="button"
                        className="reports-all-work-orders__title-link"
                        disabled={Boolean(openingId)}
                        aria-busy={openingId === row.id}
                        onClick={() => void openWorkOrder(row.id)}
                      >
                        #{row.id} — {row.title}
                      </button>
                    </td>
                    <td>{row.description ?? row.title}</td>
                    <td>{row.area}</td>
                    <td>{row.itemIssue}</td>
                    <td>{row.priority}</td>
                    <td>{row.createdAt}</td>
                    <td>{row.createdBy}</td>
                    <td>{row.assignedTo ?? "—"}</td>
                    <td>{row.completedAt ?? "—"}</td>
                    <td>{row.resolution}</td>
                    <td>{row.completedBy ?? "—"}</td>
                    <td>{formatElapsed(row.hoursOpen)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12}>
                    No completed work orders match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedWorkOrder ? (
        <DashboardWorkOrderDetailModal
          workOrder={selectedWorkOrder}
          createdByName={null}
          onClose={() => setSelectedWorkOrder(null)}
          onUpdated={() => undefined}
        />
      ) : null}
    </>
  );
}

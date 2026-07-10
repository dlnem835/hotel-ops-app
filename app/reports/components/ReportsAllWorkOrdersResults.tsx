"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import DashboardWorkOrderDetailModal from "@/app/dashboard/components/DashboardWorkOrderDetailModal";
import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import type { WorkOrderReportFilters } from "@/app/reports/lib/report-definitions";
import {
  ALL_WORK_ORDERS_SORT_COLUMNS,
  sortAllWorkOrdersReportRows,
  type AllWorkOrdersSortColumn,
  type AllWorkOrdersSortDirection,
} from "@/app/reports/lib/all-work-orders-report-sort";
import { resolveWorkOrderReportCreatedByLabel } from "@/app/reports/lib/work-order-report-types";
import type { WorkOrderReportRow } from "@/app/reports/lib/work-order-report-types";

type ReportsAllWorkOrdersResultsProps = {
  rows: WorkOrderReportRow[];
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getScrollContainer(element: HTMLElement | null): HTMLElement | null {
  let node = element?.parentElement ?? null;

  while (node) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY)) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

export default function ReportsAllWorkOrdersResults({
  rows,
}: ReportsAllWorkOrdersResultsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const [sortColumn, setSortColumn] = useState<AllWorkOrdersSortColumn>("created");
  const [sortDirection, setSortDirection] =
    useState<AllWorkOrdersSortDirection>("desc");
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [openingWorkOrderId, setOpeningWorkOrderId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [createdByName, setCreatedByName] = useState<string | null>(null);

  const sortedRows = useMemo(
    () => sortAllWorkOrdersReportRows(rows, sortColumn, sortDirection),
    [rows, sortColumn, sortDirection]
  );

  useEffect(() => {
    async function loadCreatedByName() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: teamMember } = await supabase
        .from("team_members")
        .select("first_name, last_name, username")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (teamMember) {
        setCreatedByName(
          teamMember.username ||
            [teamMember.first_name, teamMember.last_name].filter(Boolean).join(" ") ||
            null
        );
      }
    }

    void loadCreatedByName();
  }, []);

  useEffect(() => {
    if (selectedWorkOrder) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    window.requestAnimationFrame(() => {
      container.scrollTop = savedScrollTopRef.current;
    });
  }, [selectedWorkOrder]);

  function handleSort(column: AllWorkOrdersSortColumn) {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection("asc");
  }

  async function handleOpenWorkOrder(workOrderId: string) {
    if (openingWorkOrderId) return;

    scrollContainerRef.current = getScrollContainer(rootRef.current);
    savedScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;

    setOpenError(null);
    setOpeningWorkOrderId(workOrderId);

    try {
      const response = await fetch(`/api/work-orders/${workOrderId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to open work order.");
      }

      setSelectedWorkOrder(result.workOrder as WorkOrder);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to open work order.";
      setOpenError(message);
    } finally {
      setOpeningWorkOrderId(null);
    }
  }

  function handleCloseWorkOrder() {
    setSelectedWorkOrder(null);
  }

  function handleWorkOrderUpdated() {
    // Keep report filters and sort intact; detail modal handles its own refresh.
  }

  return (
    <>
      <div ref={rootRef} className="reports-wo-results reports-all-work-orders">
        <p className="reports-pm-results__lead">
          All work orders matching the selected filters.
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
                {ALL_WORK_ORDERS_SORT_COLUMNS.map((column) => {
                  const isActive = sortColumn === column.key;

                  return (
                    <th key={column.key} scope="col">
                      <button
                        type="button"
                        className="reports-all-work-orders__sort-btn"
                        onClick={() => handleSort(column.key)}
                        aria-sort={
                          isActive
                            ? sortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <span>{column.label}</span>
                        {isActive ? (
                          sortDirection === "asc" ? (
                            <ChevronUp
                              size={14}
                              className="reports-all-work-orders__sort-icon"
                              aria-hidden
                            />
                          ) : (
                            <ChevronDown
                              size={14}
                              className="reports-all-work-orders__sort-icon"
                              aria-hidden
                            />
                          )
                        ) : null}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length > 0 ? (
                sortedRows.map((row) => {
                  const isOpening = openingWorkOrderId === row.id;

                  return (
                    <tr key={row.id}>
                      <td>
                        <button
                          type="button"
                          className="reports-all-work-orders__title-link"
                          onClick={() => void handleOpenWorkOrder(row.id)}
                          disabled={Boolean(openingWorkOrderId)}
                          aria-busy={isOpening}
                        >
                          {row.title}
                        </button>
                      </td>
                      <td>{row.area}</td>
                      <td>{row.category}</td>
                      <td>{row.priority}</td>
                      <td>{row.status}</td>
                      <td>
                        {resolveWorkOrderReportCreatedByLabel({
                          createdByDisplayName: row.createdBy,
                        })}
                      </td>
                      <td>{row.createdAt}</td>
                      <td>{row.source}</td>
                      <td>{row.completedBy ?? "—"}</td>
                      <td>{row.completedAt ?? "—"}</td>
                      <td>{row.comments}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11}>No work orders match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedWorkOrder ? (
        <DashboardWorkOrderDetailModal
          workOrder={selectedWorkOrder}
          createdByName={createdByName}
          onClose={handleCloseWorkOrder}
          onUpdated={handleWorkOrderUpdated}
        />
      ) : null}
    </>
  );
}

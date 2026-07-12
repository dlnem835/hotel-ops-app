"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import DashboardWorkOrderDetailModal from "@/app/dashboard/components/DashboardWorkOrderDetailModal";
import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import { buildWorkOrdersByAreaRows } from "@/app/reports/lib/work-order-report-filters";
import {
  resolveWorkOrderReportCreatedByLabel,
  type WorkOrderReportRow,
} from "@/app/reports/lib/work-order-report-types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

type ReportsTopAreasResultsProps = {
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

export default function ReportsTopAreasResults({ rows }: ReportsTopAreasResultsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [openingWorkOrderId, setOpeningWorkOrderId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [createdByName, setCreatedByName] = useState<string | null>(null);

  const areaRows = useMemo(() => buildWorkOrdersByAreaRows(rows), [rows]);

  const workOrdersByArea = useMemo(() => {
    const grouped = new Map<string, WorkOrderReportRow[]>();

    for (const row of rows) {
      const existing = grouped.get(row.area) ?? [];
      existing.push(row);
      grouped.set(row.area, existing);
    }

    for (const [area, areaWorkOrders] of grouped.entries()) {
      grouped.set(
        area,
        [...areaWorkOrders].sort((left, right) =>
          right.createdAtIso.localeCompare(left.createdAtIso)
        )
      );
    }

    return grouped;
  }, [rows]);

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

  function handleToggleArea(areaLabel: string) {
    setExpandedArea((current) => (current === areaLabel ? null : areaLabel));
  }

  async function handleOpenWorkOrder(workOrderId: string) {
    if (openingWorkOrderId) return;

    scrollContainerRef.current = getScrollContainer(rootRef.current);
    savedScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;

    setOpenError(null);
    setOpeningWorkOrderId(workOrderId);

    try {
      const response = await tenantFetch(`/api/work-orders/${workOrderId}`);
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

  return (
    <>
      <div ref={rootRef} className="reports-wo-results reports-wo-top-areas">
        <p className="reports-pm-results__lead">
          Top work order areas matching the selected filters.
        </p>
        {openError ? (
          <p className="reports-wo-top-areas__error" role="alert">
            {openError}
          </p>
        ) : null}
        {areaRows.length > 0 ? (
          <div className="reports-wo-top-areas__list">
            {areaRows.map((row) => {
              const isExpanded = expandedArea === row.label;
              const areaWorkOrders = workOrdersByArea.get(row.label) ?? [];

              return (
                <div
                  key={row.label}
                  className={
                    isExpanded
                      ? "reports-wo-top-areas__group reports-wo-top-areas__group--expanded"
                      : "reports-wo-top-areas__group"
                  }
                >
                  <button
                    type="button"
                    className="reports-wo-top-areas__row"
                    onClick={() => handleToggleArea(row.label)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? (
                      <ChevronDown
                        size={16}
                        className="reports-wo-top-areas__chevron"
                        aria-hidden
                      />
                    ) : (
                      <ChevronRight
                        size={16}
                        className="reports-wo-top-areas__chevron"
                        aria-hidden
                      />
                    )}
                    <span className="reports-wo-top-areas__label">{row.label}</span>
                    <span className="reports-wo-top-areas__count">{row.count}</span>
                  </button>

                  {isExpanded ? (
                    <div className="reports-wo-top-areas__details">
                      {areaWorkOrders.length > 0 ? (
                        <div className="reports-pm-results__table-wrap">
                          <table className="reports-pm-results__table reports-wo-top-areas__table">
                            <thead>
                              <tr>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Created by</th>
                                <th>Created</th>
                              </tr>
                            </thead>
                            <tbody>
                              {areaWorkOrders.map((workOrder) => {
                                const isOpening = openingWorkOrderId === workOrder.id;

                                return (
                                  <tr key={workOrder.id}>
                                    <td>
                                      <button
                                        type="button"
                                        className="reports-wo-top-areas__title-link"
                                        onClick={() => void handleOpenWorkOrder(workOrder.id)}
                                        disabled={Boolean(openingWorkOrderId)}
                                        aria-busy={isOpening}
                                      >
                                        {workOrder.title}
                                      </button>
                                    </td>
                                    <td>{workOrder.category}</td>
                                    <td>{workOrder.priority}</td>
                                    <td>{workOrder.status}</td>
                                    <td>
                                      {resolveWorkOrderReportCreatedByLabel({
                                        createdByDisplayName: workOrder.createdBy,
                                      })}
                                    </td>
                                    <td>{workOrder.createdAt}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="reports-wo-top-areas__empty">
                          No work orders found for this area and selected filters.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="reports-pm-results__lead">No work orders match the selected filters.</p>
        )}
      </div>

      {selectedWorkOrder ? (
        <DashboardWorkOrderDetailModal
          workOrder={selectedWorkOrder}
          createdByName={createdByName}
          onClose={() => setSelectedWorkOrder(null)}
          onUpdated={() => undefined}
        />
      ) : null}
    </>
  );
}

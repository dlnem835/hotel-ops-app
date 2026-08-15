"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import DashboardWorkOrderDetailModal from "@/app/dashboard/components/DashboardWorkOrderDetailModal";
import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import {
  buildWorkOrdersByCategoryRows,
  buildWorkOrdersByItemIssueRows,
} from "@/app/reports/lib/work-order-report-filters";
import {
  resolveWorkOrderReportCreatedByLabel,
  type WorkOrderReportRow,
} from "@/app/reports/lib/work-order-report-types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

type ReportsTopCategoriesResultsProps = {
  rows: WorkOrderReportRow[];
  groupBy?: "category" | "itemIssue";
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

export default function ReportsTopCategoriesResults({
  rows,
  groupBy = "category",
}: ReportsTopCategoriesResultsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [openingWorkOrderId, setOpeningWorkOrderId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [createdByName, setCreatedByName] = useState<string | null>(null);

  const categoryRows = useMemo(
    () =>
      groupBy === "itemIssue"
        ? buildWorkOrdersByItemIssueRows(rows)
        : buildWorkOrdersByCategoryRows(rows),
    [rows, groupBy]
  );

  const workOrdersByCategory = useMemo(() => {
    const grouped = new Map<string, WorkOrderReportRow[]>();

    for (const row of rows) {
      const groupLabel = groupBy === "itemIssue" ? row.itemIssue : row.category;
      const existing = grouped.get(groupLabel) ?? [];
      existing.push(row);
      grouped.set(groupLabel, existing);
    }

    for (const [category, categoryRowsForGroup] of grouped.entries()) {
      grouped.set(
        category,
        [...categoryRowsForGroup].sort((left, right) =>
          right.createdAtIso.localeCompare(left.createdAtIso)
        )
      );
    }

    return grouped;
  }, [rows, groupBy]);

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

  function handleToggleCategory(categoryLabel: string) {
    setExpandedCategory((current) =>
      current === categoryLabel ? null : categoryLabel
    );
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
      <div ref={rootRef} className="reports-wo-results reports-wo-top-categories">
        <p className="reports-pm-results__lead">
          Top work order {groupBy === "itemIssue" ? "items / issues" : "categories"} matching
          the selected filters.
        </p>
        {openError ? (
          <p className="reports-wo-top-categories__error" role="alert">
            {openError}
          </p>
        ) : null}
        {categoryRows.length > 0 ? (
          <div className="reports-wo-top-categories__list">
            {categoryRows.map((row) => {
              const isExpanded = expandedCategory === row.label;
              const categoryWorkOrders = workOrdersByCategory.get(row.label) ?? [];

              return (
                <div
                  key={row.label}
                  className={
                    isExpanded
                      ? "reports-wo-top-categories__group reports-wo-top-categories__group--expanded"
                      : "reports-wo-top-categories__group"
                  }
                >
                  <button
                    type="button"
                    className="reports-wo-top-categories__row"
                    onClick={() => handleToggleCategory(row.label)}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? (
                      <ChevronDown
                        size={16}
                        className="reports-wo-top-categories__chevron"
                        aria-hidden
                      />
                    ) : (
                      <ChevronRight
                        size={16}
                        className="reports-wo-top-categories__chevron"
                        aria-hidden
                      />
                    )}
                    <span className="reports-wo-top-categories__label">{row.label}</span>
                    <span className="reports-wo-top-categories__count">{row.count}</span>
                  </button>

                  {isExpanded ? (
                    <div className="reports-wo-top-categories__details">
                      {categoryWorkOrders.length > 0 ? (
                        <div className="reports-pm-results__table-wrap">
                          <table className="reports-pm-results__table reports-wo-top-categories__table">
                            <thead>
                              <tr>
                                <th>Title</th>
                                <th>Room / Area</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Created by</th>
                                <th>Created</th>
                              </tr>
                            </thead>
                            <tbody>
                              {categoryWorkOrders.map((workOrder) => {
                                const isOpening = openingWorkOrderId === workOrder.id;

                                return (
                                  <tr key={workOrder.id}>
                                    <td>
                                      <button
                                        type="button"
                                        className="reports-wo-top-categories__title-link"
                                        onClick={() => void handleOpenWorkOrder(workOrder.id)}
                                        disabled={Boolean(openingWorkOrderId)}
                                        aria-busy={isOpening}
                                      >
                                        {workOrder.title}
                                      </button>
                                    </td>
                                    <td>{workOrder.area}</td>
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
                        <p className="reports-wo-top-categories__empty">
                          No work orders found for this category and selected filters.
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

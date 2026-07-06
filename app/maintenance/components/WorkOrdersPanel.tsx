"use client";

import { ChevronRight } from "lucide-react";
import { WorkOrder } from "../lib/maintenance-types";
import { WorkOrderListFilters } from "../lib/work-order-list-filters";
import { formatWorkOrderCardTimestamp } from "../lib/work-order-display";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import "@/app/lib/one-eyrie-updated-timestamp.css";
import { getWorkOrderPriorityBadgeClassName } from "@/app/lib/workOrderPriority";
import WorkOrderFiltersButton from "./WorkOrderFiltersButton";
import "@/app/components/dashboard-list-card.css";

type WorkOrdersPanelProps = {
  workOrders: WorkOrder[];
  onOpenWorkOrder?: (workOrder: WorkOrder) => void;
  compact?: boolean;
  className?: string;
  hideHeader?: boolean;
  workOrderFilters?: WorkOrderListFilters;
  onWorkOrderFiltersChange?: (filters: WorkOrderListFilters) => void;
};

export default function WorkOrdersPanel({
  workOrders,
  onOpenWorkOrder,
  compact = false,
  className,
  hideHeader = false,
  workOrderFilters,
  onWorkOrderFiltersChange,
}: WorkOrdersPanelProps) {
  const showFilters = Boolean(workOrderFilters && onWorkOrderFiltersChange);

  return (
    <div
      className={`maintenance-work-order-panel${className ? ` ${className}` : ""}`}
      style={{
        background: ONE_EYRIE.surface,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div className="maintenance-work-order-panel__header">
        <div className="maintenance-work-order-panel__header-row">
          <div className="maintenance-work-order-panel__header-copy">
            {!hideHeader ? (
              <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
                {compact ? "Today's Work Orders" : "Priority Queue"}
              </div>
            ) : (
              <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
                Priority Queue
              </div>
            )}
            <div
              style={{
                color: ONE_EYRIE.textSubtle,
                fontSize: "12px",
                marginTop: "4px",
              }}
            >
              Guest-impacting • Urgent → Important → Normal • Oldest first
            </div>
          </div>

          {showFilters ? (
            <WorkOrderFiltersButton
              filters={workOrderFilters!}
              onFiltersChange={onWorkOrderFiltersChange!}
            />
          ) : null}
        </div>
      </div>

      {workOrders.length === 0 ? (
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", padding: "12px 0" }}>
          No open work orders. Guest issues and pass-ons will appear here.
        </div>
      ) : (
        <div className="dashboard-list-panel__rows maintenance-work-order-panel__rows">
          {workOrders.map((order) => {
            const clickable = Boolean(onOpenWorkOrder);

            return (
              <div
                key={order.id}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                className="dashboard-list-card maintenance-work-order-card"
                onClick={clickable ? () => onOpenWorkOrder?.(order) : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenWorkOrder?.(order);
                        }
                      }
                    : undefined
                }
                style={{ cursor: clickable ? "pointer" : "default" }}
              >
                <div className="dashboard-list-card__body">
                  <div className="dashboard-list-card__title-row">
                    <span className="dashboard-list-card__title">{order.subject}</span>
                    <span className={getWorkOrderPriorityBadgeClassName(order.priority)}>
                      {order.priority}
                    </span>
                  </div>
                  <div className="dashboard-list-card__location">
                    {order.areaLabel || "No area specified"}
                  </div>
                  <div
                    className={
                      order.commentsUpdatedAt
                        ? "one-eyrie-updated-timestamp"
                        : "maintenance-work-order-card__opened"
                    }
                  >
                    {formatWorkOrderCardTimestamp(order)}
                  </div>
                </div>
                {clickable ? (
                  <ChevronRight size={18} aria-hidden className="dashboard-list-card__chevron" />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { ChevronRight } from "lucide-react";
import { WorkOrder } from "../lib/maintenance-types";
import {
  formatWorkOrderAge,
  workOrderListDescription,
} from "../lib/work-order-display";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { getWorkOrderPriorityPillStyle } from "@/app/lib/workOrderPriority";
import "@/app/components/dashboard-list-card.css";

type WorkOrdersPanelProps = {
  workOrders: WorkOrder[];
  onOpenWorkOrder?: (workOrder: WorkOrder) => void;
  compact?: boolean;
};

export default function WorkOrdersPanel({
  workOrders,
  onOpenWorkOrder,
  compact = false,
}: WorkOrdersPanelProps) {
  return (
    <div
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
      <div>
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
          {compact ? "Today's Work Orders" : "Work Order Checklist"}
        </div>
        <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "4px" }}>
          Guest-impacting · Urgent → Important → Normal · oldest first
        </div>
      </div>

      {workOrders.length === 0 ? (
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", padding: "12px 0" }}>
          No open work orders. Guest issues and pass-ons will appear here.
        </div>
      ) : (
        <div className="dashboard-list-panel__rows">
          {workOrders.map((order) => {
            const description = workOrderListDescription(order);
            const clickable = Boolean(onOpenWorkOrder);

            return (
              <div
                key={order.id}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                className="dashboard-list-card"
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
                    <span style={getWorkOrderPriorityPillStyle(order.priority)}>
                      {order.priority}
                    </span>
                  </div>
                  <div className="dashboard-list-card__location">
                    {order.areaLabel || "No area specified"}
                    {order.sourceModule ? ` · From ${order.sourceModule}` : ""}
                  </div>
                  {description ? (
                    <div className="dashboard-list-card__description">{description}</div>
                  ) : null}
                  <div className="dashboard-list-card__meta">
                    {formatWorkOrderAge(order.createdAt)}
                    {order.createdByLabel || order.createdBy ? ` · ${order.createdByLabel || order.createdBy}` : ""}
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

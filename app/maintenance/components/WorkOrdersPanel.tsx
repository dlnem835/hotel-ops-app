"use client";

import { ChevronRight } from "lucide-react";
import { WorkOrder } from "../lib/maintenance-types";
import {
  formatWorkOrderAge,
  workOrderListDescription,
} from "../lib/work-order-display";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { getWorkOrderPriorityPillStyle } from "@/app/lib/workOrderPriority";

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
        workOrders.map((order) => {
          const description = workOrderListDescription(order);
          const clickable = Boolean(onOpenWorkOrder);

          return (
            <div
              key={order.id}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
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
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                border: `1px solid ${ONE_EYRIE.border}`,
                borderRadius: "10px",
                padding: "12px",
                background: ONE_EYRIE.surfacePanel,
                cursor: clickable ? "pointer" : "default",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ color: ONE_EYRIE.text, fontWeight: 800, fontSize: "14px" }}>
                    {order.subject}
                  </span>
                  <span style={getWorkOrderPriorityPillStyle(order.priority)}>
                    {order.priority}
                  </span>
                </div>
                <div
                  style={{
                    color: ONE_EYRIE.textMuted,
                    fontSize: "12px",
                    lineHeight: 1.45,
                  }}
                >
                  {order.areaLabel || "No area specified"}
                  {order.sourceModule ? ` · From ${order.sourceModule}` : ""}
                </div>
                {description ? (
                  <div
                    style={{
                      color: ONE_EYRIE.textMuted,
                      fontSize: "12px",
                      marginTop: "6px",
                      lineHeight: 1.45,
                    }}
                  >
                    {description}
                  </div>
                ) : null}
                <div
                  style={{
                    color: ONE_EYRIE.textSubtle,
                    fontSize: "11px",
                    marginTop: "6px",
                  }}
                >
                  {formatWorkOrderAge(order.createdAt)}
                  {order.createdBy ? ` · ${order.createdBy}` : ""}
                </div>
              </div>
              {clickable ? (
                <ChevronRight
                  size={18}
                  aria-hidden
                  style={{ flexShrink: 0, color: ONE_EYRIE.textSubtle, opacity: 0.75 }}
                />
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

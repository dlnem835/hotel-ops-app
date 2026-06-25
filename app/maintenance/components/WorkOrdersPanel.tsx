"use client";

import { WorkOrder } from "../lib/maintenance-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { getWorkOrderPriorityPillStyle } from "@/app/lib/workOrderPriority";
import {
  forestOutlineHoverHandlers,
  FOREST_OUTLINE_BUTTON,
} from "@/app/settings/lib/settings-ui-interactions";

type WorkOrdersPanelProps = {
  workOrders: WorkOrder[];
  onOpenWorkOrder?: (workOrder: WorkOrder) => void;
  compact?: boolean;
};

function formatAge(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "Opened today";
  if (days === 1) return "Opened yesterday";
  return `Open ${days} days`;
}

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
        workOrders.map((order, index) => (
          <div
            key={order.id}
            style={{
              border: `1px solid ${ONE_EYRIE.border}`,
              borderRadius: "10px",
              padding: "12px",
              background: ONE_EYRIE.surfacePanel,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              <div style={{ minWidth: 0 }}>
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
                    {index + 1}. {order.subject}
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
                  {order.sourceModule ? ` · from ${order.sourceModule}` : ""}
                </div>
                {order.sourceNote && (
                  <div
                    style={{
                      color: ONE_EYRIE.textSubtle,
                      fontSize: "12px",
                      marginTop: "6px",
                      lineHeight: 1.45,
                    }}
                  >
                    {order.sourceNote}
                  </div>
                )}
                <div
                  style={{
                    color: ONE_EYRIE.textSubtle,
                    fontSize: "11px",
                    marginTop: "6px",
                  }}
                >
                  {formatAge(order.createdAt)}
                  {order.createdBy ? ` · ${order.createdBy}` : ""}
                </div>
              </div>
              {onOpenWorkOrder && (
                <button
                  type="button"
                  onClick={() => onOpenWorkOrder(order)}
                  style={FOREST_OUTLINE_BUTTON}
                  {...forestOutlineHoverHandlers()}
                >
                  Open
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

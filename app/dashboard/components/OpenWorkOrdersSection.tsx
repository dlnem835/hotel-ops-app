"use client";

import Link from "next/link";
import { DashboardWorkOrder } from "../lib/operational-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { getWorkOrderPriorityPillStyle } from "@/app/lib/workOrderPriority";

type OpenWorkOrdersSectionProps = {
  workOrders: DashboardWorkOrder[];
  totalCount: number;
};

export default function OpenWorkOrdersSection({
  workOrders,
  totalCount,
}: OpenWorkOrdersSectionProps) {
  return (
    <section
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
      <div className="one-eyrie-section-header-row">
        <div className="one-eyrie-section-header-row__main">
          <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
            Work Order Checklist
          </div>
          <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "4px" }}>
            Guest-impacting · Urgent → Important → Normal · oldest first
          </div>
        </div>
        <Link
          href="/maintenance"
          style={{
            color: ONE_EYRIE.gold,
            fontSize: "12px",
            fontWeight: 800,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          View all ({totalCount}) →
        </Link>
      </div>

      {workOrders.length === 0 ? (
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", padding: "12px 0" }}>
          No open work orders. Guest issues and pass-ons will appear here.
        </div>
      ) : (
        workOrders.map((order, index) => (
          <Link
            key={order.id}
            href="/maintenance"
            className="dashboard-clickable-card"
            style={{
              display: "block",
              border: `1px solid ${ONE_EYRIE.border}`,
              borderRadius: "10px",
              padding: "12px",
              background: ONE_EYRIE.surfacePanel,
              textDecoration: "none",
              color: ONE_EYRIE.text,
            }}
          >
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
            </div>
          </Link>
        ))
      )}
    </section>
  );
}

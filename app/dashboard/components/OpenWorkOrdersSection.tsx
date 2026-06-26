"use client";

import Link from "next/link";
import { DashboardWorkOrder } from "../lib/operational-types";
import { FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { DashboardSectionTitle } from "./DashboardCard";

function priorityDotColor(priority: string): string {
  if (priority === "Urgent") return "#8B5252";
  if (priority === "Important") return ONE_EYRIE.gold;
  return FOREST.border;
}

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
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <DashboardSectionTitle
          title="Open Work Orders"
          subtitle="Live engineering checklist"
        />
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
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", padding: "8px 2px" }}>
          No open work orders.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {workOrders.map((order) => (
              <Link
                key={order.id}
                href="/maintenance"
                className="dashboard-clickable-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "11px 12px",
                  borderRadius: "10px",
                  border: `1px solid ${ONE_EYRIE.borderDivider}`,
                  background: ONE_EYRIE.surfacePanel,
                  textDecoration: "none",
                  color: ONE_EYRIE.text,
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "999px",
                    background: priorityDotColor(order.priority),
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "13px" }}>{order.subject}</div>
                  {order.areaLabel && (
                    <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "11px", marginTop: "2px" }}>
                      {order.areaLabel}
                    </div>
                  )}
                </div>
              </Link>
            ))}
        </div>
      )}
    </section>
  );
}

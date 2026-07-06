"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DashboardWorkOrder } from "../lib/operational-types";
import { formatWorkOrderCardTimestamp } from "@/app/maintenance/lib/work-order-display";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { getWorkOrderPriorityBadgeClassName } from "@/app/lib/workOrderPriority";
import "@/app/lib/one-eyrie-updated-timestamp.css";
import "@/app/components/dashboard-list-card.css";

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
      className="dashboard-open-work-orders-section"
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
            Priority Queue
          </div>
          <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "4px" }}>
            Guest-impacting • Urgent → Important → Normal • Oldest first
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
        <div className="dashboard-list-panel__rows dashboard-priority-queue__rows">
          {workOrders.map((order) => (
            <Link
              key={order.id}
              href="/maintenance"
              className="dashboard-list-card dashboard-priority-queue-card dashboard-clickable-card"
              style={{
                textDecoration: "none",
                color: "inherit",
              }}
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
                      : "dashboard-priority-queue-card__opened"
                  }
                >
                  {formatWorkOrderCardTimestamp(order)}
                </div>
              </div>
              <ChevronRight
                size={18}
                aria-hidden
                className="dashboard-list-card__chevron"
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

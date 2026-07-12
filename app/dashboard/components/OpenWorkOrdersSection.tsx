"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import {
  DashboardWorkOrder,
  OperationalDashboardPayload,
} from "../lib/operational-types";
import DashboardWorkOrderDetailModal from "./DashboardWorkOrderDetailModal";
import { formatWorkOrderCardTimestamp } from "@/app/maintenance/lib/work-order-display";
import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { getWorkOrderPriorityBadgeClassName } from "@/app/lib/workOrderPriority";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import "@/app/lib/one-eyrie-updated-timestamp.css";
import "@/app/components/dashboard-list-card.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type OpenWorkOrdersSectionProps = {
  workOrders: DashboardWorkOrder[];
  totalCount: number;
};

export default function OpenWorkOrdersSection({
  workOrders,
  totalCount,
}: OpenWorkOrdersSectionProps) {
  const [previewWorkOrders, setPreviewWorkOrders] = useState(workOrders);
  const [previewTotalCount, setPreviewTotalCount] = useState(totalCount);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [openingWorkOrderId, setOpeningWorkOrderId] = useState<number | null>(null);
  const [createdByName, setCreatedByName] = useState<string | null>(null);

  useEffect(() => {
    setPreviewWorkOrders(workOrders);
    setPreviewTotalCount(totalCount);
  }, [workOrders, totalCount]);

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

  const reloadPreviewWorkOrders = useCallback(async () => {
    const response = await fetch("/api/dashboard");
    const result = (await response.json()) as OperationalDashboardPayload;

    if (!response.ok) return;

    setPreviewWorkOrders(result.workOrders);
    setPreviewTotalCount(result.openWorkOrderCount);
  }, []);

  async function openWorkOrder(orderId: number) {
    setOpeningWorkOrderId(orderId);

    const response = await tenantFetch(`/api/work-orders/${orderId}`);
    const result = await response.json();
    setOpeningWorkOrderId(null);

    if (!response.ok) {
      alert(result.error || "Unable to open work order");
      return;
    }

    setSelectedWorkOrder(result.workOrder);
  }

  function handleWorkOrderUpdated() {
    void reloadPreviewWorkOrders();
    if (selectedWorkOrder) {
      void tenantFetch(`/api/work-orders/${selectedWorkOrder.id}`)
        .then((response) => response.json())
        .then((result) => {
          if (result.workOrder) {
            setSelectedWorkOrder(result.workOrder);
          }
        })
        .catch(() => undefined);
    }
  }

  return (
    <>
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
              WO Priority Queue
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
            View all ({previewTotalCount}) →
          </Link>
        </div>

        {previewWorkOrders.length === 0 ? (
          <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", padding: "12px 0" }}>
            No open work orders. Guest issues and pass-ons will appear here.
          </div>
        ) : (
          <div className="dashboard-list-panel__rows dashboard-priority-queue__rows">
            {previewWorkOrders.map((order) => {
              const isOpening = openingWorkOrderId === order.id;

              return (
                <div
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  className="dashboard-list-card dashboard-priority-queue-card dashboard-clickable-card"
                  onClick={() => void openWorkOrder(order.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openWorkOrder(order.id);
                    }
                  }}
                  style={{
                    cursor: isOpening ? "wait" : "pointer",
                    opacity: isOpening ? 0.7 : 1,
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
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selectedWorkOrder ? (
        <DashboardWorkOrderDetailModal
          workOrder={selectedWorkOrder}
          createdByName={createdByName}
          onClose={() => setSelectedWorkOrder(null)}
          onUpdated={handleWorkOrderUpdated}
        />
      ) : null}
    </>
  );
}

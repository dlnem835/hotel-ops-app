"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import WorkOrderMetricCards from "@/app/maintenance/components/WorkOrderMetricCards";
import WorkOrdersPanel from "@/app/maintenance/components/WorkOrdersPanel";
import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import { OperationalDashboardPayload } from "../lib/operational-types";
import DashboardWorkOrderDetailModal from "./DashboardWorkOrderDetailModal";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import "@/app/maintenance/maintenance-responsive.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/** Compact Front Desk preview — full queue lives on Maintenance. */
const DASHBOARD_WO_QUEUE_LIMIT = 4;

type DashboardWorkOrdersSectionProps = {
  workOrders: WorkOrder[];
  openWorkOrderCount: number;
};

/**
 * Reuses Maintenance Work Order KPI cards + Priority Queue panel.
 * Dashboard only: no filters, capped queue + View All. Maintenance unchanged.
 */
export default function DashboardWorkOrdersSection({
  workOrders,
  openWorkOrderCount,
}: DashboardWorkOrdersSectionProps) {
  const [previewWorkOrders, setPreviewWorkOrders] = useState(workOrders);
  const [previewOpenCount, setPreviewOpenCount] = useState(openWorkOrderCount);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(
    null
  );
  const [createdByName, setCreatedByName] = useState<string | null>(null);

  useEffect(() => {
    setPreviewWorkOrders(workOrders);
    setPreviewOpenCount(openWorkOrderCount);
  }, [workOrders, openWorkOrderCount]);

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

  const queuedWorkOrders = useMemo(
    () => previewWorkOrders.slice(0, DASHBOARD_WO_QUEUE_LIMIT),
    [previewWorkOrders]
  );
  const hasMoreWorkOrders = previewWorkOrders.length > DASHBOARD_WO_QUEUE_LIMIT;

  const reloadPreviewWorkOrders = useCallback(async () => {
    const response = await tenantFetch("/api/dashboard");
    const result = (await response.json()) as OperationalDashboardPayload;
    if (!response.ok) return;
    setPreviewWorkOrders(result.workOrders || []);
    setPreviewOpenCount(result.openWorkOrderCount);
  }, []);

  async function openWorkOrder(workOrder: WorkOrder) {
    const response = await tenantFetch(`/api/work-orders/${workOrder.id}`);
    const result = await response.json();
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
          if (result.workOrder) setSelectedWorkOrder(result.workOrder);
        })
        .catch(() => undefined);
    }
  }

  return (
    <>
      <section
        className="dashboard-work-orders-section"
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
            Work Orders
          </div>
          <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "4px" }}>
            Same priority queue as Maintenance
          </div>
        </div>

        <WorkOrderMetricCards
          openWorkOrders={previewOpenCount}
          workOrders={previewWorkOrders}
        />

        <WorkOrdersPanel
          hideHeader
          workOrders={queuedWorkOrders}
          onOpenWorkOrder={(order) => void openWorkOrder(order)}
        />

        {hasMoreWorkOrders ? (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link
              href="/maintenance"
              style={{
                color: ONE_EYRIE.gold,
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              View All →
            </Link>
          </div>
        ) : null}
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

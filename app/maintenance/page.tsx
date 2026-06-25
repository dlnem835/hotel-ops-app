"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { APP_SHELL, MAIN_CONTENT } from "@/app/lib/oneEyrieLayout";
import {
  forestHoverHandlers,
  PRIMARY_BUTTON,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";
import MaintenanceMetricCards from "./components/MaintenanceMetricCards";
import PmTileGridSection from "./components/PmTileGridSection";
import WorkOrdersPanel from "./components/WorkOrdersPanel";
import Next3PmsPanel from "./components/Next3PmsPanel";
import EngineeringPerformancePanel from "./components/EngineeringPerformancePanel";
import WorkOrderModal, {
  WorkOrderModalInitialValues,
} from "./components/WorkOrderModal";
import {
  MaintenanceDashboardPayload,
  PmPriorityQueueItem,
  PmTile,
  WorkOrder,
} from "./lib/maintenance-types";
import "./maintenance-responsive.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MaintenancePage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<MaintenanceDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingPm, setStartingPm] = useState(false);
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderInitial, setWorkOrderInitial] = useState<
    WorkOrderModalInitialValues | undefined
  >(undefined);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [completingWo, setCompletingWo] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/maintenance/dashboard");
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(result.error || "Unable to load maintenance dashboard");
      return;
    }

    setDashboard(result);
  }, []);

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: teamMember } = await supabase
        .from("team_members")
        .select("first_name, last_name, username")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (teamMember) {
        const name =
          [teamMember.first_name, teamMember.last_name].filter(Boolean).join(" ") ||
          teamMember.username ||
          null;
        setCreatedByName(name);
      }

      await loadDashboard();
    }

    void init();
  }, [loadDashboard]);

  async function startPmForAssignment(assignmentId: number) {
    setStartingPm(true);
    const response = await fetch("/api/maintenance/pm-occurrences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: assignmentId }),
    });
    const result = await response.json();
    setStartingPm(false);

    if (!response.ok) {
      alert(result.error || "Unable to start PM");
      return;
    }

    router.push(`/maintenance/pm/${result.occurrence.id}`);
  }

  function handleStartPmFromQueue(item: PmPriorityQueueItem) {
    void startPmForAssignment(item.assignmentId);
  }

  function handleOpenPmTile(tile: PmTile) {
    void startPmForAssignment(tile.assignmentId);
  }

  function openWorkOrderModal(initial?: WorkOrderModalInitialValues) {
    setWorkOrderInitial(initial);
    setWorkOrderModalOpen(true);
  }

  async function completeWorkOrder() {
    if (!selectedWorkOrder) return;
    setCompletingWo(true);
    const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Completed" }),
    });
    setCompletingWo(false);

    if (!response.ok) {
      const result = await response.json();
      alert(result.error || "Unable to complete work order");
      return;
    }

    setSelectedWorkOrder(null);
    await loadDashboard();
  }

  return (
    <main style={APP_SHELL}>
      <OneEyrieSidebar active="Maintenance" />

      <section
        className="maintenance-mobile-page-content"
        style={MAIN_CONTENT}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <OneEyriePageHeader
            title="Maintenance"
            subtitle="Work orders and preventive maintenance at a glance"
          />
          <button
            type="button"
            onClick={() => openWorkOrderModal()}
            disabled={startingPm}
            style={{
              ...PRIMARY_BUTTON,
              marginTop: "4px",
              opacity: startingPm ? 0.6 : 1,
              cursor: startingPm ? "wait" : "pointer",
            }}
            {...forestHoverHandlers(startingPm)}
          >
            + New Work Order
          </button>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid #8B5252",
              color: "#C9A8A8",
            }}
          >
            {error}
            {error.includes("work_orders") && (
              <div style={{ marginTop: "8px", fontSize: "13px", color: ONE_EYRIE.textMuted }}>
                Run migration 009 in Supabase SQL Editor, then refresh.
              </div>
            )}
          </div>
        )}

        {loading || !dashboard ? (
          <div style={{ color: ONE_EYRIE.textMuted, padding: "24px 0" }}>
            Loading maintenance dashboard...
          </div>
        ) : (
          <>
            <MaintenanceMetricCards metrics={dashboard.metrics} />

            <div
              className="maintenance-mobile-dashboard-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.7fr) minmax(320px, 1fr)",
                gap: "16px",
                alignItems: "start",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <WorkOrdersPanel
                  workOrders={dashboard.workOrders}
                  onOpenWorkOrder={setSelectedWorkOrder}
                />

                <PmTileGridSection
                  tiles={dashboard.pmTiles}
                  onOpenPm={handleOpenPmTile}
                />
              </div>

              <div
                className="maintenance-mobile-dashboard-sidebar"
                style={{ display: "flex", flexDirection: "column", gap: "12px" }}
              >
                <EngineeringPerformancePanel
                  performance={dashboard.engineeringPerformance}
                />
                <Next3PmsPanel
                  items={dashboard.pmPriorityQueue}
                  onStartPm={handleStartPmFromQueue}
                />
              </div>
            </div>
          </>
        )}

        <WorkOrderModal
          open={workOrderModalOpen}
          initialValues={workOrderInitial}
          createdBy={createdByName}
          onClose={() => setWorkOrderModalOpen(false)}
          onCreated={() => void loadDashboard()}
        />

        {selectedWorkOrder && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 999,
              padding: "16px",
            }}
            onClick={() => setSelectedWorkOrder(null)}
          >
            <div
              style={{
                width: "640px",
                maxWidth: "100%",
                background: ONE_EYRIE.row,
                border: `1px solid ${ONE_EYRIE.border}`,
                borderRadius: "14px",
                padding: "22px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ margin: "0 0 8px", color: ONE_EYRIE.text }}>
                {selectedWorkOrder.subject}
              </h2>
              <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", marginBottom: "14px" }}>
                {selectedWorkOrder.areaLabel || "No area"}
                {selectedWorkOrder.sourceModule
                  ? ` · from ${selectedWorkOrder.sourceModule}`
                  : ""}
              </div>
              {selectedWorkOrder.description && (
                <p
                  style={{
                    color: ONE_EYRIE.textRow,
                    fontSize: "14px",
                    lineHeight: 1.5,
                    margin: "0 0 14px",
                  }}
                >
                  {selectedWorkOrder.description}
                </p>
              )}
              {selectedWorkOrder.sourceNote && (
                <p
                  style={{
                    color: ONE_EYRIE.textSubtle,
                    fontSize: "13px",
                    lineHeight: 1.5,
                    margin: "0 0 14px",
                  }}
                >
                  Source note: {selectedWorkOrder.sourceNote}
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedWorkOrder(null)}
                  style={{
                    ...SETTINGS_BUTTON_BASE,
                    background: "transparent",
                    color: ONE_EYRIE.textMuted,
                    border: `1px solid ${ONE_EYRIE.border}`,
                    borderRadius: "12px",
                    height: "44px",
                    padding: "0 18px",
                    fontWeight: 800,
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void completeWorkOrder()}
                  disabled={completingWo}
                  style={{
                    ...PRIMARY_BUTTON,
                    opacity: completingWo ? 0.6 : 1,
                    cursor: completingWo ? "not-allowed" : "pointer",
                  }}
                  {...forestHoverHandlers(completingWo)}
                >
                  {completingWo ? "Saving..." : "Mark Completed"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { X } from "lucide-react";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import OneEyrieDesktopHeaderActions from "@/app/components/OneEyrieDesktopHeaderActions";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { APP_SHELL, APP_SHELL_CLASS, MAIN_CONTENT, MAIN_CONTENT_CLASS } from "@/app/lib/oneEyrieLayout";
import {
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import {
  forestHoverHandlers,
  goldHoverHandlers,
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
import WorkOrderPhotoAttachment from "./components/WorkOrderPhotoAttachment";
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
  const [workOrderComments, setWorkOrderComments] = useState("");
  const [completingWo, setCompletingWo] = useState(false);
  const [savingComments, setSavingComments] = useState(false);
  const [commentsSaveMessage, setCommentsSaveMessage] = useState<string | null>(null);

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
        setCreatedByName(teamMember.username || null);
      }

      await loadDashboard();
    }

    void init();
  }, [loadDashboard]);

  useEffect(() => {
    setWorkOrderComments(selectedWorkOrder?.comments || "");
    setCommentsSaveMessage(null);
  }, [selectedWorkOrder]);

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

  async function saveWorkOrderComments() {
    if (!selectedWorkOrder) return;
    setSavingComments(true);
    setCommentsSaveMessage(null);

    const response = await fetch(`/api/work-orders/${selectedWorkOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: workOrderComments.trim() || null }),
    });
    setSavingComments(false);

    if (!response.ok) {
      const result = await response.json();
      alert(result.error || "Unable to save comments");
      return;
    }

    const result = await response.json();
    setSelectedWorkOrder(result.workOrder);
    setWorkOrderComments(result.workOrder.comments || "");
    setCommentsSaveMessage("Comments saved.");
    window.setTimeout(() => setCommentsSaveMessage(null), 2500);
    await loadDashboard();
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
    <main style={APP_SHELL} className={APP_SHELL_CLASS}>
      <OneEyrieSidebar active="Maintenance" />

      <section
        className={`maintenance-mobile-page-content ${MAIN_CONTENT_CLASS}`}
        style={MAIN_CONTENT}
      >
        <OneEyriePageHeader
          title="Maintenance"
          subtitle="Work orders and preventive maintenance at a glance"
          actions={
            <OneEyrieDesktopHeaderActions>
              <button
                type="button"
                onClick={() => openWorkOrderModal()}
                disabled={startingPm}
                style={{
                  ...PRIMARY_BUTTON,
                  opacity: startingPm ? 0.6 : 1,
                  cursor: startingPm ? "wait" : "pointer",
                }}
                {...forestHoverHandlers(startingPm)}
              >
                + New Work Order
              </button>
            </OneEyrieDesktopHeaderActions>
          }
        />

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
              className="maintenance-mobile-dashboard-grid one-eyrie-split-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.7fr) minmax(260px, 1fr)",
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
            style={ONE_EYRIE_MODAL_OVERLAY}
            onClick={() => setSelectedWorkOrder(null)}
          >
            <div
              style={{ ...ONE_EYRIE_MODAL_BOX, width: "720px", maxWidth: "100%" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={ONE_EYRIE_MODAL_HEADER}>
                <h2 style={{ margin: 0, color: ONE_EYRIE.text }}>
                  {selectedWorkOrder.subject}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedWorkOrder(null)}
                  style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
              </div>
              <div
                style={{
                  color: ONE_EYRIE.textMuted,
                  fontSize: "13px",
                  marginBottom: "18px",
                }}
              >
                {selectedWorkOrder.areaLabel || "No area"}
                {selectedWorkOrder.sourceModule
                  ? ` · from ${selectedWorkOrder.sourceModule}`
                  : ""}
              </div>
              {selectedWorkOrder.description && (
                <div
                  style={{
                    background: "#0D0D0D",
                    borderTop: "1px solid #2A2A2A",
                    borderRight: "1px solid #2A2A2A",
                    borderBottom: "1px solid #2A2A2A",
                    borderLeft: `3px solid ${ONE_EYRIE.gold}`,
                    borderRadius: "8px",
                    padding: "12px 14px",
                    marginBottom: "18px",
                    color: "#FFFFFF",
                    fontSize: "14px",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedWorkOrder.description}
                </div>
              )}
              {selectedWorkOrder.sourceNote && (
                <p
                  style={{
                    color: ONE_EYRIE.textSubtle,
                    fontSize: "11px",
                    lineHeight: 1.45,
                    margin: "0 0 18px",
                    opacity: 0.85,
                  }}
                >
                  Source note: {selectedWorkOrder.sourceNote}
                </p>
              )}
              {selectedWorkOrder.photoUrl && (
                <div style={{ marginBottom: "18px" }}>
                  <WorkOrderPhotoAttachment photoUrl={selectedWorkOrder.photoUrl} />
                </div>
              )}
              <label style={{ display: "block", marginBottom: "20px" }}>
                <div
                  style={{
                    color: ONE_EYRIE.textSubtle,
                    fontSize: "12px",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  Comments
                </div>
                <textarea
                  value={workOrderComments}
                  onChange={(e) => setWorkOrderComments(e.target.value)}
                  rows={4}
                  placeholder="Add notes about progress, parts needed, or completion details..."
                  className="one-eyrie-maintenance-field"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "14px",
                    lineHeight: 1.5,
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              </label>
              <div
                className="one-eyrie-modal-footer--wrap"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "4px",
                }}
              >
                {commentsSaveMessage ? (
                  <span
                    style={{
                      marginRight: "auto",
                      color: ONE_EYRIE.textMuted,
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    {commentsSaveMessage}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedWorkOrder(null)}
                  disabled={completingWo || savingComments}
                  style={{
                    ...SETTINGS_BUTTON_BASE,
                    background: "transparent",
                    color: ONE_EYRIE.textMuted,
                    border: `1px solid ${ONE_EYRIE.border}`,
                    borderRadius: "12px",
                    height: "44px",
                    padding: "0 18px",
                    fontWeight: 800,
                    opacity: completingWo || savingComments ? 0.6 : 1,
                    cursor: completingWo || savingComments ? "not-allowed" : "pointer",
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void saveWorkOrderComments()}
                  disabled={completingWo || savingComments}
                  style={{
                    ...SETTINGS_BUTTON_BASE,
                    background: "transparent",
                    border: `1px solid ${ONE_EYRIE.gold}`,
                    color: ONE_EYRIE.gold,
                    borderRadius: "12px",
                    padding: "0 18px",
                    height: "44px",
                    fontWeight: 800,
                    opacity: completingWo || savingComments ? 0.6 : 1,
                    cursor: completingWo || savingComments ? "not-allowed" : "pointer",
                  }}
                  {...goldHoverHandlers("secondary", completingWo || savingComments)}
                >
                  {savingComments ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => void completeWorkOrder()}
                  disabled={completingWo || savingComments}
                  style={{
                    ...PRIMARY_BUTTON,
                    opacity: completingWo || savingComments ? 0.6 : 1,
                    cursor: completingWo || savingComments ? "not-allowed" : "pointer",
                  }}
                  {...forestHoverHandlers(completingWo || savingComments)}
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { InspectionPeriod } from "@/app/inspections/lib/inspection-types";
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
  goldFilledHoverHandlers,
  goldHoverHandlers,
  GOLD_FILLED_BUTTON,
  GOLD_OUTLINE_ACTION_BUTTON,
  START_WORK_BUTTON,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";
import MaintenanceKpiPeriodFilters from "./components/MaintenanceKpiPeriodFilters";
import MaintenanceMetricCards from "./components/MaintenanceMetricCards";
import MaintenanceSectionHeader from "./components/MaintenanceSectionHeader";
import PmTileGridSection from "./components/PmTileGridSection";
import WorkOrderMetricCards from "./components/WorkOrderMetricCards";
import WorkOrdersPanel from "./components/WorkOrdersPanel";
import PmHealthDetailModal from "./components/PmHealthDetailModal";
import WorkOrderModal, {
  WorkOrderModalInitialValues,
} from "./components/WorkOrderModal";
import WorkOrderPhotoAttachment from "./components/WorkOrderPhotoAttachment";
import WorkOrderDetailMetadata from "./components/WorkOrderDetailMetadata";
import {
  MaintenanceDashboardPayload,
  PmTile,
  WorkOrder,
} from "./lib/maintenance-types";
import {
  resolveMemberDisplayLabel,
  useMemberDisplayNameResolver,
} from "@/app/lib/use-member-display-name";
import {
  applyWorkOrderListFilters,
  DEFAULT_WORK_ORDER_LIST_FILTERS,
  WorkOrderListFilters,
} from "./lib/work-order-list-filters";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import "./maintenance-responsive.css";
import "./maintenance-light-theme.css";

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
  const [commentsSaved, setCommentsSaved] = useState(false);
  const [pmHealthModalOpen, setPmHealthModalOpen] = useState(false);
  const [kpiPeriod, setKpiPeriod] = useState<InspectionPeriod>("mtd");
  const [workOrderFilters, setWorkOrderFilters] = useState<WorkOrderListFilters>(
    DEFAULT_WORK_ORDER_LIST_FILTERS
  );
  const memberResolver = useMemberDisplayNameResolver();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await tenantFetch("/api/maintenance/dashboard");
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
        setCreatedByName(
          teamMember.username ||
            [teamMember.first_name, teamMember.last_name].filter(Boolean).join(" ") ||
            null
        );
      }

      await loadDashboard();
    }

    void init();
  }, [loadDashboard]);

  useEffect(() => {
    setWorkOrderComments(selectedWorkOrder?.comments || "");
    setCommentsSaved(false);
  }, [selectedWorkOrder?.id]);

  async function startPmForAssignment(assignmentId: number) {
    setStartingPm(true);
    const response = await tenantFetch("/api/maintenance/pm-occurrences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignment_id: assignmentId,
        created_by: createdByName,
      }),
    });
    const result = await response.json();
    setStartingPm(false);

    if (!response.ok) {
      alert(result.error || "Unable to start PM");
      return;
    }

    router.push(`/maintenance/pm/${result.occurrence.id}`);
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
    setCommentsSaved(false);

    const response = await tenantFetch(`/api/work-orders/${selectedWorkOrder.id}`, {
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
    setCommentsSaved(true);
    await loadDashboard();
  }

  async function completeWorkOrder() {
    if (!selectedWorkOrder) return;
    setCompletingWo(true);
    const response = await tenantFetch(`/api/work-orders/${selectedWorkOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "Completed",
        completed_by: createdByName,
      }),
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

  const filteredWorkOrders = useMemo(() => {
    if (!dashboard) return [];
    return applyWorkOrderListFilters(dashboard.workOrders, workOrderFilters);
  }, [dashboard, workOrderFilters]);

  return (
    <main style={APP_SHELL} className={`${APP_SHELL_CLASS} one-eyrie-maintenance-route`}>
      <OneEyrieSidebar active="Maintenance" />

      <section
        className={`maintenance-mobile-page-content maintenance-page-content one-eyrie-maintenance-page ${MAIN_CONTENT_CLASS}`}
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
                  ...START_WORK_BUTTON,
                  opacity: startingPm ? 0.6 : 1,
                  cursor: startingPm ? "wait" : "pointer",
                }}
                className="one-eyrie-btn one-eyrie-btn--start-work one-eyrie-btn--lg"
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

        {!loading && dashboard ? (
          <MaintenanceKpiPeriodFilters
            period={kpiPeriod}
            onPeriodChange={setKpiPeriod}
          />
        ) : null}

        {loading || !dashboard ? (
          <div className="maintenance-dashboard-loading" style={{ color: ONE_EYRIE.textMuted, padding: "24px 0" }}>
            Loading maintenance dashboard...
          </div>
        ) : (
          <div className="maintenance-workspaces-grid maintenance-mobile-dashboard-grid one-eyrie-split-grid">
            <div className="maintenance-pm-workspace">
              <MaintenanceSectionHeader title="Preventive Maintenance" />

              <MaintenanceMetricCards
                metrics={dashboard.metrics}
                completedPms={
                  dashboard.engineeringPerformance.completedByKpiPeriod[kpiPeriod]
                }
              />

              <PmTileGridSection tiles={dashboard.pmTiles} onOpenPm={handleOpenPmTile} />
            </div>

            <div className="maintenance-wo-workspace">
              <MaintenanceSectionHeader title="Work Orders" uppercase showDivider />

              <WorkOrderMetricCards
                openWorkOrders={dashboard.metrics.openWorkOrders}
                workOrders={dashboard.workOrders}
              />

              <WorkOrdersPanel
                hideHeader
                workOrders={filteredWorkOrders}
                workOrderFilters={workOrderFilters}
                onWorkOrderFiltersChange={setWorkOrderFilters}
                onOpenWorkOrder={setSelectedWorkOrder}
              />
            </div>
          </div>
        )}

        <WorkOrderModal
          open={workOrderModalOpen}
          initialValues={workOrderInitial}
          createdBy={createdByName}
          onClose={() => setWorkOrderModalOpen(false)}
          onCreated={() => void loadDashboard()}
        />

        {dashboard ? (
          <PmHealthDetailModal
            open={pmHealthModalOpen}
            pmHealth={dashboard.engineeringPerformance.pmHealth}
            onClose={() => setPmHealthModalOpen(false)}
          />
        ) : null}

        {selectedWorkOrder && (
          <div
            className="one-eyrie-modal-overlay one-eyrie-maintenance-detail-modal-overlay"
            style={ONE_EYRIE_MODAL_OVERLAY}
            onClick={() => setSelectedWorkOrder(null)}
          >
            <div
              className="one-eyrie-modal one-eyrie-maintenance-detail-modal"
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
              <WorkOrderDetailMetadata
                locationLabel={selectedWorkOrder.areaLabel || "No area"}
                sourceModule={selectedWorkOrder.sourceModule}
                createdByLabel={
                  selectedWorkOrder.createdByLabel ||
                  (selectedWorkOrder.createdBy
                    ? resolveMemberDisplayLabel(memberResolver, selectedWorkOrder.createdBy)
                    : null)
                }
                createdAt={selectedWorkOrder.createdAt}
                isCompleted={selectedWorkOrder.status === "Completed"}
                completedByLabel={
                  selectedWorkOrder.completedByLabel ||
                  (selectedWorkOrder.completedBy
                    ? resolveMemberDisplayLabel(memberResolver, selectedWorkOrder.completedBy)
                    : null)
                }
                completedAt={selectedWorkOrder.completedAt}
              />
              {selectedWorkOrder.description && (
                <div
                  className="maintenance-wo-detail-description"
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
                  className="maintenance-wo-detail-source-note"
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
                  onChange={(e) => {
                    setWorkOrderComments(e.target.value);
                    setCommentsSaved(false);
                  }}
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
                    ...GOLD_OUTLINE_ACTION_BUTTON,
                    opacity: completingWo || savingComments ? 0.6 : 1,
                    cursor: completingWo || savingComments ? "not-allowed" : "pointer",
                  }}
                  className="one-eyrie-btn one-eyrie-btn--gold-outline one-eyrie-btn--md"
                  {...goldHoverHandlers("secondary", completingWo || savingComments)}
                >
                  {savingComments ? "Saving..." : commentsSaved ? "Saved" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => void completeWorkOrder()}
                  disabled={completingWo || savingComments}
                  style={{
                    ...GOLD_FILLED_BUTTON,
                    opacity: completingWo || savingComments ? 0.6 : 1,
                    cursor: completingWo || savingComments ? "not-allowed" : "pointer",
                  }}
                  className="one-eyrie-btn one-eyrie-btn--gold-filled one-eyrie-btn--md"
                  {...goldFilledHoverHandlers(completingWo || savingComments)}
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

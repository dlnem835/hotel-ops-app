"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import WorkOrderDetailMetadata from "@/app/maintenance/components/WorkOrderDetailMetadata";
import WorkOrderPhotoAttachment from "@/app/maintenance/components/WorkOrderPhotoAttachment";
import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import {
  goldFilledHoverHandlers,
  goldHoverHandlers,
  GOLD_FILLED_BUTTON,
  GOLD_OUTLINE_ACTION_BUTTON,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";
import {
  resolveMemberDisplayLabel,
  useMemberDisplayNameResolver,
} from "@/app/lib/use-member-display-name";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import WorkOrderResolutionModal from "@/app/maintenance/components/WorkOrderResolutionModal";
import { useModalScrollLock } from "@/app/lib/use-modal-scroll-lock";
import WorkOrderItemIssueSelect from "@/app/maintenance/components/WorkOrderItemIssueSelect";

type DashboardWorkOrderDetailModalProps = {
  workOrder: WorkOrder;
  createdByName: string | null;
  onClose: () => void;
  onUpdated: () => void;
};

export default function DashboardWorkOrderDetailModal({
  workOrder,
  createdByName,
  onClose,
  onUpdated,
}: DashboardWorkOrderDetailModalProps) {
  const [currentWorkOrder, setCurrentWorkOrder] = useState(workOrder);
  const [workOrderComments, setWorkOrderComments] = useState(workOrder.comments || "");
  const [workOrderItemIssue, setWorkOrderItemIssue] = useState(
    workOrder.item || "Other"
  );
  const [completingWo, setCompletingWo] = useState(false);
  const [savingComments, setSavingComments] = useState(false);
  const [commentsSaved, setCommentsSaved] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const memberResolver = useMemberDisplayNameResolver();
  const isCompleted = currentWorkOrder.status === "Completed";
  useModalScrollLock(true);

  useEffect(() => {
    setCommentsSaved(false);
  }, [workOrder.id]);

  useEffect(() => {
    setCurrentWorkOrder(workOrder);
    setWorkOrderComments(workOrder.comments || "");
    setWorkOrderItemIssue(workOrder.item || "Other");
  }, [workOrder]);

  async function saveWorkOrderComments() {
    setSavingComments(true);
    setCommentsSaved(false);

    const response = await tenantFetch(`/api/work-orders/${currentWorkOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comments: workOrderComments.trim() || null,
        item: workOrderItemIssue,
      }),
    });
    setSavingComments(false);

    if (!response.ok) {
      const result = await response.json();
      alert(result.error || "Unable to save comments");
      return;
    }

    const result = await response.json();
    setCurrentWorkOrder(result.workOrder);
    setWorkOrderComments(result.workOrder.comments || "");
    setCommentsSaved(true);
    onUpdated();
  }

  async function completeWorkOrder(
    resolution: string,
    resolutionPhotoUrl: string | null
  ) {
    setCompletingWo(true);
    const response = await tenantFetch(`/api/work-orders/${currentWorkOrder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "Completed",
        completed_by: createdByName,
        comments: resolution,
        resolution_photo_url: resolutionPhotoUrl,
      }),
    });
    setCompletingWo(false);

    if (!response.ok) {
      const result = await response.json();
      alert(result.error || "Unable to complete work order");
      return;
    }

    setResolutionOpen(false);
    onClose();
    onUpdated();
  }

  return (
    <div style={ONE_EYRIE_MODAL_OVERLAY} onClick={onClose}>
      <div
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: "720px",
          maxWidth: "100%",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <h2 style={{ margin: 0, color: ONE_EYRIE.text }}>{currentWorkOrder.subject}</h2>
          <button
            type="button"
            onClick={onClose}
            style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>
        <WorkOrderDetailMetadata
          locationLabel={currentWorkOrder.areaLabel || "No area"}
          sourceModule={currentWorkOrder.sourceModule}
          createdByLabel={
            currentWorkOrder.createdByLabel ||
            (currentWorkOrder.createdBy
              ? resolveMemberDisplayLabel(memberResolver, currentWorkOrder.createdBy)
              : null)
          }
          createdAt={currentWorkOrder.createdAt}
          isCompleted={isCompleted}
          completedByLabel={
            currentWorkOrder.completedByLabel ||
            (currentWorkOrder.completedBy
              ? resolveMemberDisplayLabel(memberResolver, currentWorkOrder.completedBy)
              : null)
          }
          completedAt={currentWorkOrder.completedAt}
        />
        {currentWorkOrder.description && (
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
            {currentWorkOrder.description}
          </div>
        )}
        {currentWorkOrder.sourceNote && (
          <p
            style={{
              color: ONE_EYRIE.textSubtle,
              fontSize: "11px",
              lineHeight: 1.45,
              margin: "0 0 18px",
              opacity: 0.85,
            }}
          >
            Source note: {currentWorkOrder.sourceNote}
          </p>
        )}
        {currentWorkOrder.photoUrl && (
          <div style={{ marginBottom: "18px" }}>
            <WorkOrderPhotoAttachment photoUrl={currentWorkOrder.photoUrl} />
          </div>
        )}
        {currentWorkOrder.resolutionPhotoUrl && (
          <div style={{ marginBottom: "18px" }}>
            <WorkOrderPhotoAttachment
              photoUrl={currentWorkOrder.resolutionPhotoUrl}
              label="Resolution Photo"
            />
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
            Item / Issue
          </div>
          <WorkOrderItemIssueSelect
            value={workOrderItemIssue}
            disabled={isCompleted || completingWo || savingComments}
            onChange={(value) => {
              setWorkOrderItemIssue(value);
              setCommentsSaved(false);
            }}
          />
        </label>
        <label style={{ display: "block", marginBottom: "20px" }}>
          <div
            style={{
              color: ONE_EYRIE.textSubtle,
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "6px",
            }}
          >
            {isCompleted ? "Resolution" : "Comments"}
          </div>
          <textarea
            value={workOrderComments}
            onChange={(e) => {
              setWorkOrderComments(e.target.value);
              setCommentsSaved(false);
            }}
            rows={4}
            placeholder={
              isCompleted
                ? "No resolution was recorded."
                : "Add notes about progress or parts needed..."
            }
            readOnly={isCompleted}
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
            onClick={onClose}
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
          {!isCompleted ? (
            <>
              <button
                type="button"
                onClick={() => void saveWorkOrderComments()}
                disabled={completingWo || savingComments}
                style={{
                  ...GOLD_OUTLINE_ACTION_BUTTON,
                  opacity: completingWo || savingComments ? 0.6 : 1,
                  cursor:
                    completingWo || savingComments ? "not-allowed" : "pointer",
                }}
                className="one-eyrie-btn one-eyrie-btn--gold-outline one-eyrie-btn--md"
                {...goldHoverHandlers("secondary", completingWo || savingComments)}
              >
                {savingComments ? "Saving..." : commentsSaved ? "Saved" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setResolutionOpen(true)}
                disabled={completingWo || savingComments}
                style={{
                  ...GOLD_FILLED_BUTTON,
                  opacity: completingWo || savingComments ? 0.6 : 1,
                  cursor:
                    completingWo || savingComments ? "not-allowed" : "pointer",
                }}
                className="one-eyrie-btn one-eyrie-btn--gold-filled one-eyrie-btn--md"
                {...goldFilledHoverHandlers(completingWo || savingComments)}
              >
                Mark Completed
              </button>
            </>
          ) : null}
        </div>
      </div>
      {resolutionOpen ? (
        <WorkOrderResolutionModal
          open
          saving={completingWo}
          onClose={() => setResolutionOpen(false)}
          onSubmit={(resolution, resolutionPhotoUrl) =>
            void completeWorkOrder(resolution, resolutionPhotoUrl)
          }
        />
      ) : null}
    </div>
  );
}

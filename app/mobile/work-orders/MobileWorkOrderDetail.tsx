"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import WorkOrderDetailMetadata from "@/app/maintenance/components/WorkOrderDetailMetadata";
import { getWorkOrderPriorityBadgeClassName } from "@/app/lib/workOrderPriority";
import "@/app/components/dashboard-list-card.css";
import {
  resolveMemberDisplayLabel,
  useMemberDisplayNameResolver,
} from "@/app/lib/use-member-display-name";
import {
  completeWorkOrder,
  fetchWorkOrderById,
  resolveWorkOrderCreatedBy,
  saveWorkOrderComments,
} from "./lib/work-order-shared";
import WorkOrderPhotoAttachment from "@/app/maintenance/components/WorkOrderPhotoAttachment";

type MobileWorkOrderDetailProps = {
  workOrderId: number;
};

export default function MobileWorkOrderDetail({ workOrderId }: MobileWorkOrderDetailProps) {
  const router = useRouter();
  const memberResolver = useMemberDisplayNameResolver();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingComments, setSavingComments] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void resolveWorkOrderCreatedBy().then(setCurrentUserName);
  }, []);

  useEffect(() => {
    let mounted = true;

    void fetchWorkOrderById(workOrderId)
      .then((order) => {
        if (!mounted) return;

        if (!order) {
          setError("Work order not found.");
          setLoading(false);
          return;
        }

        if (order.status === "Completed" || order.status === "Cancelled") {
          router.replace("/mobile/work-orders");
          return;
        }

        setWorkOrder(order);
        setComments(order.comments || "");
        setLoading(false);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load work order"
        );
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [workOrderId, router]);

  async function handleSaveComments() {
    if (!workOrder) return;
    setSavingComments(true);
    setActionError(null);
    setSaveMessage(null);

    try {
      const updated = await saveWorkOrderComments(workOrder.id, comments);
      setWorkOrder(updated);
      setComments(updated.comments || "");
      setSaveMessage("Comments saved.");
      window.setTimeout(() => setSaveMessage(null), 2500);
    } catch (saveError) {
      setActionError(
        saveError instanceof Error ? saveError.message : "Unable to save comments"
      );
    } finally {
      setSavingComments(false);
    }
  }

  async function handleComplete() {
    if (!workOrder) return;
    setCompleting(true);
    setActionError(null);

    try {
      await completeWorkOrder(workOrder.id, currentUserName);
      router.push("/mobile/work-orders");
    } catch (completeError) {
      setActionError(
        completeError instanceof Error ? completeError.message : "Unable to complete work order"
      );
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="one-eyrie-mobile__inner one-eyrie-mobile-work-orders">
        <div className="one-eyrie-mobile-status">Loading work order…</div>
      </div>
    );
  }

  if (error || !workOrder) {
    return (
      <div className="one-eyrie-mobile__inner one-eyrie-mobile-work-orders">
        <Link href="/mobile/work-orders" className="one-eyrie-mobile-back">
          ← Work Orders
        </Link>
        <div className="one-eyrie-mobile-error">{error || "Work order not found."}</div>
      </div>
    );
  }

  const busy = savingComments || completing;

  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-work-orders">
      <Link href="/mobile/work-orders" className="one-eyrie-mobile-back">
        ← Work Orders
      </Link>

      <div className="one-eyrie-mobile-work-order-detail__header dashboard-list-card__title-row">
        <h1 className="one-eyrie-mobile-page-title dashboard-list-card__title">{workOrder.subject}</h1>
        <span className={getWorkOrderPriorityBadgeClassName(workOrder.priority)}>
          {workOrder.priority}
        </span>
      </div>

      <WorkOrderDetailMetadata
        locationLabel={workOrder.areaLabel || "No area specified"}
        sourceModule={workOrder.sourceModule}
        createdByLabel={
          workOrder.createdByLabel ||
          (workOrder.createdBy
            ? resolveMemberDisplayLabel(memberResolver, workOrder.createdBy)
            : null)
        }
        createdAt={workOrder.createdAt}
        isCompleted={workOrder.status === "Completed"}
        completedByLabel={
          workOrder.completedByLabel ||
          (workOrder.completedBy
            ? resolveMemberDisplayLabel(memberResolver, workOrder.completedBy)
            : null)
        }
        completedAt={workOrder.completedAt}
      />

      {workOrder.description ? (
        <div className="one-eyrie-mobile-work-order-detail__panel">
          <p>{workOrder.description}</p>
        </div>
      ) : null}

      {workOrder.sourceNote ? (
        <p className="one-eyrie-mobile-work-order-detail__source-note">
          Source note: {workOrder.sourceNote}
        </p>
      ) : null}

      {workOrder.photoUrl ? (
        <WorkOrderPhotoAttachment
          photoUrl={workOrder.photoUrl}
          className="one-eyrie-mobile-work-order-detail__photo"
        />
      ) : null}

      <label className="one-eyrie-mobile-field one-eyrie-mobile-work-order-detail__comments">
        <span>Comments</span>
        <textarea
          value={comments}
          onChange={(event) => setComments(event.target.value)}
          rows={4}
          placeholder="Add notes about progress, parts needed, or completion details..."
        />
      </label>

      {actionError ? <div className="one-eyrie-mobile-error">{actionError}</div> : null}
      {saveMessage ? (
        <div className="one-eyrie-mobile-work-order-detail__saved">{saveMessage}</div>
      ) : null}

      <div className="one-eyrie-mobile-work-order-detail__actions">
        <Link
          href="/mobile/work-orders"
          className={`one-eyrie-mobile-btn one-eyrie-mobile-btn--ghost${busy ? " one-eyrie-mobile-btn--disabled" : ""}`}
          aria-disabled={busy}
          onClick={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          Close
        </Link>
        <button
          type="button"
          className="one-eyrie-mobile-btn one-eyrie-mobile-btn--gold-outline"
          disabled={busy}
          onClick={() => void handleSaveComments()}
        >
          {savingComments ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="one-eyrie-mobile-btn one-eyrie-mobile-btn--gold"
          disabled={busy}
          onClick={() => void handleComplete()}
        >
          {completing ? "Saving…" : "Mark Completed"}
        </button>
      </div>
    </div>
  );
}

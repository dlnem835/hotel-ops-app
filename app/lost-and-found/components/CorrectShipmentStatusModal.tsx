"use client";

import { useEffect, useState } from "react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  LOST_ITEM_STATUS,
  SHIPPO_OWNED_LOST_ITEM_STATUSES,
  type LostItemStatus,
} from "@/app/lib/lost-found-shipping/status";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

type Props = {
  itemId: string | number;
  currentStatus: string;
  open: boolean;
  onClose: () => void;
  onCorrected: () => void;
};

export default function CorrectShipmentStatusModal({
  itemId,
  currentStatus,
  open,
  onClose,
  onCorrected,
}: Props) {
  const [nextStatus, setNextStatus] = useState<LostItemStatus>(
    LOST_ITEM_STATUS.shipped
  );
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNextStatus(LOST_ITEM_STATUS.shipped);
    setReason("");
    setConfirmed(false);
    setBusy(false);
    setError(null);
  }, [open, itemId]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await tenantFetch(
        `/api/lost-and-found/${itemId}/correct-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            reason,
            confirmed,
          }),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Unable to correct shipment status");
      }
      onCorrected();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to correct status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="correct-shipment-status-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: ONE_EYRIE.surface,
          border: `1px solid ${ONE_EYRIE.gold}`,
          borderRadius: 12,
          padding: 20,
          color: ONE_EYRIE.text,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="correct-shipment-status-title"
          style={{ margin: "0 0 8px", fontSize: 18, color: ONE_EYRIE.gold }}
        >
          Correct Shipment Status
        </h2>
        <p style={{ margin: "0 0 14px", color: ONE_EYRIE.textMuted, fontSize: 14 }}>
          Current status: <strong style={{ color: ONE_EYRIE.text }}>{currentStatus}</strong>
          . Future carrier updates may overwrite this override.
        </p>

        <label style={{ display: "block", marginBottom: 10, fontSize: 13 }}>
          New status
          <select
            value={nextStatus}
            onChange={(event) =>
              setNextStatus(event.target.value as LostItemStatus)
            }
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "8px 10px",
              background: ONE_EYRIE.surfaceInset,
              color: ONE_EYRIE.text,
              border: `1px solid ${ONE_EYRIE.borderInput}`,
              borderRadius: 8,
            }}
          >
            {SHIPPO_OWNED_LOST_ITEM_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "block", marginBottom: 10, fontSize: 13 }}>
          Reason (required)
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Why is this correction needed?"
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "8px 10px",
              background: ONE_EYRIE.surfaceInset,
              color: ONE_EYRIE.text,
              border: `1px solid ${ONE_EYRIE.borderInput}`,
              borderRadius: 8,
              resize: "vertical",
            }}
          />
        </label>

        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            marginBottom: 14,
            fontSize: 13,
            color: ONE_EYRIE.textMuted,
          }}
        >
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            style={{ marginTop: 3 }}
          />
          <span>
            I confirm this administrator override and understand carrier tracking
            may change the status again.
          </span>
        </label>

        {error ? (
          <div
            role="alert"
            style={{
              marginBottom: 12,
              color: "#FECACA",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${ONE_EYRIE.border}`,
              background: "transparent",
              color: ONE_EYRIE.textMuted,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !confirmed || reason.trim().length < 5}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${ONE_EYRIE.gold}`,
              background: ONE_EYRIE.gold,
              color: ONE_EYRIE.black,
              fontWeight: 700,
              cursor: "pointer",
              opacity: busy || !confirmed || reason.trim().length < 5 ? 0.5 : 1,
            }}
          >
            {busy ? "Saving…" : "Correct status"}
          </button>
        </div>
      </div>
    </div>
  );
}

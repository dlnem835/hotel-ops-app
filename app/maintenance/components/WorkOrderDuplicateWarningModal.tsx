"use client";

import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  GOLD_FILLED_BUTTON,
  GOLD_OUTLINE_ACTION_BUTTON,
  SETTINGS_BUTTON_BASE,
  goldFilledHoverHandlers,
  goldHoverHandlers,
} from "@/app/settings/lib/settings-ui-interactions";
import type { DuplicateWorkOrderCandidate } from "@/app/maintenance/lib/work-order-duplicate-types";

type WorkOrderDuplicateWarningModalProps = {
  candidates: DuplicateWorkOrderCandidate[];
  busy?: boolean;
  onViewExisting: (id: number) => void;
  onCreateAnyway: () => void;
  onCancel: () => void;
};

export default function WorkOrderDuplicateWarningModal({
  candidates,
  busy = false,
  onViewExisting,
  onCreateAnyway,
  onCancel,
}: WorkOrderDuplicateWarningModalProps) {
  const primary = candidates[0];
  if (!primary) return null;

  return (
    <div
      className="one-eyrie-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onCancel}
    >
      <div
        className="one-eyrie-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wo-duplicate-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          background: ONE_EYRIE.surface,
          border: `1px solid ${ONE_EYRIE.border}`,
          borderRadius: "14px",
          padding: "20px",
        }}
      >
        <h2
          id="wo-duplicate-title"
          style={{ margin: "0 0 8px", color: ONE_EYRIE.gold, fontSize: "20px" }}
        >
          Possible Duplicate Work Order
        </h2>
        <p style={{ margin: "0 0 16px", color: ONE_EYRIE.textMuted, fontSize: "14px" }}>
          An active Work Order may already exist for this issue.
        </p>

        <div style={{ display: "grid", gap: "12px", marginBottom: "18px" }}>
          {candidates.slice(0, 3).map((candidate) => (
            <div
              key={candidate.id}
              style={{
                border: `1px solid ${ONE_EYRIE.border}`,
                borderRadius: "10px",
                padding: "12px 14px",
                background: ONE_EYRIE.surfaceInset,
              }}
            >
              <div style={{ color: ONE_EYRIE.text, fontWeight: 800, marginBottom: "6px" }}>
                {candidate.subject}
              </div>
              <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", lineHeight: 1.45 }}>
                <div>
                  <strong style={{ color: ONE_EYRIE.textSubtle }}>Location:</strong>{" "}
                  {candidate.areaLabel || "—"}
                </div>
                <div>
                  <strong style={{ color: ONE_EYRIE.textSubtle }}>Item/Issue:</strong>{" "}
                  {candidate.item || "—"}
                </div>
                <div>
                  <strong style={{ color: ONE_EYRIE.textSubtle }}>Description:</strong>{" "}
                  {candidate.description || "—"}
                </div>
                <div>
                  <strong style={{ color: ONE_EYRIE.textSubtle }}>Status:</strong>{" "}
                  {candidate.status}
                </div>
                <div>
                  <strong style={{ color: ONE_EYRIE.textSubtle }}>Created:</strong>{" "}
                  {new Date(candidate.createdAt).toLocaleString()}
                </div>
                <div>
                  <strong style={{ color: ONE_EYRIE.textSubtle }}>Created by:</strong>{" "}
                  {candidate.createdByLabel || candidate.createdBy || "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onViewExisting(candidate.id)}
                disabled={busy}
                style={{
                  ...GOLD_OUTLINE_ACTION_BUTTON,
                  marginTop: "10px",
                  height: "36px",
                  fontSize: "12px",
                  opacity: busy ? 0.6 : 1,
                }}
                {...goldHoverHandlers("secondary", busy)}
              >
                View Existing Work Order
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              ...SETTINGS_BUTTON_BASE,
              height: "44px",
              padding: "0 16px",
              borderRadius: "12px",
              border: `1px solid ${ONE_EYRIE.border}`,
              background: "transparent",
              color: ONE_EYRIE.textMuted,
              fontWeight: 800,
              opacity: busy ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreateAnyway}
            disabled={busy}
            style={{
              ...GOLD_FILLED_BUTTON,
              opacity: busy ? 0.6 : 1,
              cursor: busy ? "not-allowed" : "pointer",
            }}
            {...goldFilledHoverHandlers(busy)}
          >
            {busy ? "Creating…" : "Create Anyway"}
          </button>
        </div>
      </div>
    </div>
  );
}

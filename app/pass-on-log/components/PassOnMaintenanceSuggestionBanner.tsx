"use client";

import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type PassOnMaintenanceSuggestionBannerProps = {
  promptLabel: string;
  onCreateWorkOrder: () => void;
  onDismiss: () => void;
};

/**
 * Unobtrusive draft-card banner — no AI branding.
 */
export default function PassOnMaintenanceSuggestionBanner({
  promptLabel,
  onCreateWorkOrder,
  onDismiss,
}: PassOnMaintenanceSuggestionBannerProps) {
  return (
    <div
      className="pass-on-maintenance-suggestion"
      role="status"
      style={{
        gridColumn: "1 / -1",
        marginBottom: "4px",
        padding: "12px 14px",
        borderRadius: "10px",
        border: `1px solid ${ONE_EYRIE.border}`,
        background: ONE_EYRIE.surfaceInset,
      }}
    >
      <div
        style={{
          color: ONE_EYRIE.gold,
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        Possible maintenance issue
      </div>
      <div
        style={{
          color: ONE_EYRIE.text,
          fontSize: "14px",
          fontWeight: 600,
          lineHeight: 1.4,
          marginBottom: "10px",
        }}
      >
        Create a Work Order for {promptLabel}?
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <button
          type="button"
          onClick={onCreateWorkOrder}
          style={{
            border: "none",
            borderRadius: "8px",
            padding: "8px 12px",
            background: ONE_EYRIE.gold,
            color: ONE_EYRIE.black,
            fontSize: "13px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Create Work Order
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            border: `1px solid ${ONE_EYRIE.border}`,
            borderRadius: "8px",
            padding: "8px 12px",
            background: "transparent",
            color: ONE_EYRIE.textMuted,
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

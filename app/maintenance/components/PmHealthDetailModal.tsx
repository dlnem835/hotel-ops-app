"use client";

import { X } from "lucide-react";
import { PmHealthSummary } from "../lib/maintenance-types";
import { getPmHealthStatusPresentation } from "../lib/pm-health-status";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";

type PmHealthDetailModalProps = {
  open: boolean;
  pmHealth: PmHealthSummary;
  onClose: () => void;
};

const HEALTH_EXPLANATION = [
  "Completed on time improves health.",
  "Late completions lower health.",
  "Missed PMs have the greatest impact.",
  "The overall health status is based on the timeliness and consistency of preventive maintenance completion.",
];

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        padding: "10px 0",
        borderBottom: `1px solid ${ONE_EYRIE.borderDivider}`,
      }}
    >
      <span style={{ color: ONE_EYRIE.textSubtle, fontSize: "13px", fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ color: ONE_EYRIE.text, fontSize: "13px", fontWeight: 800 }}>
        {value}
      </span>
    </div>
  );
}

export default function PmHealthDetailModal({
  open,
  pmHealth,
  onClose,
}: PmHealthDetailModalProps) {
  if (!open) return null;

  const presentation = getPmHealthStatusPresentation(pmHealth.status);

  return (
    <div style={ONE_EYRIE_MODAL_OVERLAY} onClick={onClose}>
      <div
        style={{ ...ONE_EYRIE_MODAL_BOX, width: "520px", maxWidth: "100%" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <h2 style={{ margin: 0, color: ONE_EYRIE.text }}>
            Preventive Maintenance Health
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ marginBottom: "8px", color: ONE_EYRIE.textSubtle, fontSize: "12px", fontWeight: 700 }}>
          Overall Status
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "16px 18px",
            borderRadius: "12px",
            background: presentation.background,
            border: `1px solid ${presentation.border}`,
            marginBottom: "20px",
          }}
        >
          <span aria-hidden style={{ fontSize: "22px", lineHeight: 1 }}>
            {presentation.emoji}
          </span>
          <span
            style={{
              color: presentation.accent,
              fontSize: "22px",
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            {presentation.label}
          </span>
        </div>

        <div
          style={{
            background: ONE_EYRIE.surfaceInset,
            border: `1px solid ${ONE_EYRIE.border}`,
            borderRadius: "10px",
            padding: "4px 14px",
            marginBottom: "20px",
          }}
        >
          <CountRow label="Current PMs" value={pmHealth.currentPms} />
          <CountRow label="Completed On Time" value={pmHealth.completedOnTime} />
          <CountRow label="Completed Late" value={pmHealth.completedLate} />
          <CountRow label="Past Due" value={pmHealth.pastDueCount} />
          <CountRow label="Missed PMs" value={pmHealth.missedCount} />
        </div>

        <div
          style={{
            color: ONE_EYRIE.gold,
            fontWeight: 800,
            fontSize: "13px",
            marginBottom: "8px",
          }}
        >
          How is health determined?
        </div>

        <div
          style={{
            background: ONE_EYRIE.surfaceInset,
            border: `1px solid ${ONE_EYRIE.border}`,
            borderRadius: "10px",
            padding: "14px 16px",
          }}
        >
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              color: ONE_EYRIE.textMuted,
              fontSize: "13px",
              lineHeight: 1.55,
            }}
          >
            {HEALTH_EXPLANATION.map((line) => (
              <li key={line} style={{ marginBottom: "4px" }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

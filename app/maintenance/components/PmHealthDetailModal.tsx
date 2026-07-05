"use client";

import { X } from "lucide-react";
import { PmHealthSummary } from "../lib/maintenance-types";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
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
  "Higher on-time completion improves health.",
  "Lower late completion is better.",
  "Lower overdue PMs are better.",
  "Missed PMs have the greatest negative impact.",
];

type BreakdownTone = "green" | "gold" | "red" | "mutedGreen";

type MetricPolarity = "positive" | "negative";

const TONE_STYLES: Record<
  BreakdownTone,
  { text: string; bar: string; track: string }
> = {
  green: {
    text: FOREST.text,
    bar: FOREST.border,
    track: "rgba(61, 107, 79, 0.18)",
  },
  gold: {
    text: ONE_EYRIE.gold,
    bar: ONE_EYRIE.gold,
    track: "rgba(200, 169, 106, 0.14)",
  },
  red: {
    text: FLAT_RED.text,
    bar: FLAT_RED.border,
    track: "rgba(139, 82, 82, 0.18)",
  },
  mutedGreen: {
    text: FOREST.text,
    bar: FOREST.border,
    track: "rgba(61, 107, 79, 0.12)",
  },
};

function formatBreakdownPercent(
  count: number,
  total: number,
  polarity: MetricPolarity = "positive"
): number {
  if (total <= 0) return 0;
  const rounded = Math.round((count / total) * 100);
  if (polarity === "negative" && count > 0 && rounded === 0) {
    return 1;
  }
  return rounded;
}

function resolveBarWidth(percent: number, count: number, polarity: MetricPolarity): number {
  const clamped = Math.min(100, Math.max(0, percent));

  if (polarity === "positive") {
    return clamped;
  }

  if (count === 0) {
    return 0;
  }

  return Math.max(clamped, clamped === 0 ? 3 : clamped);
}

function resolveTone(
  polarity: MetricPolarity,
  count: number,
  negativeColor: "gold" | "red"
): BreakdownTone {
  if (polarity === "positive") {
    return "green";
  }

  if (count === 0) {
    return "mutedGreen";
  }

  return negativeColor;
}

function HealthBreakdownRow({
  label,
  count,
  percent,
  polarity,
  negativeColor = "red",
  isLast = false,
}: {
  label: string;
  count: number;
  percent: number;
  polarity: MetricPolarity;
  negativeColor?: "gold" | "red";
  isLast?: boolean;
}) {
  const tone = resolveTone(polarity, count, negativeColor);
  const styles = TONE_STYLES[tone];
  const barWidth = resolveBarWidth(percent, count, polarity);

  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: isLast ? "none" : `1px solid ${ONE_EYRIE.borderDivider}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <span style={{ color: ONE_EYRIE.textSubtle, fontSize: "13px", fontWeight: 600 }}>
          {label}
        </span>
        <span style={{ color: styles.text, fontSize: "13px", fontWeight: 800, whiteSpace: "nowrap" }}>
          {percent}% ({count})
        </span>
      </div>
      <div
        style={{
          height: "4px",
          borderRadius: "999px",
          background: styles.track,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${barWidth}%`,
            height: "100%",
            borderRadius: "999px",
            background: styles.bar,
            opacity: polarity === "positive" || count === 0 ? 0.85 : 0.92,
          }}
        />
      </div>
    </div>
  );
}

export default function PmHealthDetailModal({
  open,
  pmHealth,
  onClose,
}: PmHealthDetailModalProps) {
  if (!open) return null;

  const total =
    pmHealth.completedOnTime +
    pmHealth.completedLate +
    pmHealth.pastDueCount +
    pmHealth.missedCount;

  const onTimePercent = formatBreakdownPercent(pmHealth.completedOnTime, total, "positive");
  const latePercent = formatBreakdownPercent(pmHealth.completedLate, total, "negative");
  const overduePercent = formatBreakdownPercent(pmHealth.pastDueCount, total, "negative");
  const missedPercent = formatBreakdownPercent(pmHealth.missedCount, total, "negative");

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

        <div
          style={{
            color: ONE_EYRIE.gold,
            fontWeight: 800,
            fontSize: "13px",
            marginBottom: "10px",
          }}
        >
          Health Breakdown
        </div>

        <div
          style={{
            background: ONE_EYRIE.surfaceInset,
            border: `1px solid ${ONE_EYRIE.border}`,
            borderRadius: "10px",
            padding: "0 14px",
            marginBottom: "20px",
          }}
        >
          <HealthBreakdownRow
            label="Completed On Time"
            count={pmHealth.completedOnTime}
            percent={onTimePercent}
            polarity="positive"
          />
          <HealthBreakdownRow
            label="Completed Late"
            count={pmHealth.completedLate}
            percent={latePercent}
            polarity="negative"
            negativeColor="gold"
          />
          <HealthBreakdownRow
            label="Currently Overdue"
            count={pmHealth.pastDueCount}
            percent={overduePercent}
            polarity="negative"
            negativeColor="red"
          />
          <HealthBreakdownRow
            label="Missed PMs"
            count={pmHealth.missedCount}
            percent={missedPercent}
            polarity="negative"
            negativeColor="red"
            isLast
          />
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

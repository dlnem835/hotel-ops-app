"use client";

import type { CSSProperties } from "react";
import { FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type LostFoundShippingBadgeProps = {
  badge: string;
};

const BADGE_STYLES: Record<string, CSSProperties> = {
  "Awaiting Guest": {
    background: "#2A2418",
    borderColor: "#8B7355",
    color: "#D4C4A8",
  },
  "Awaiting Payment": {
    background: "#7C4A03",
    borderColor: ONE_EYRIE.gold,
    color: "#FEF3C7",
  },
  "Payment Failed": {
    background: "#1E1414",
    borderColor: "#8B5252",
    color: "#C9A8A8",
  },
  Paid: {
    background: FOREST.bgSoft,
    borderColor: FOREST.border,
    color: FOREST.text,
  },
  "Label Ready": {
    background: FOREST.bg,
    borderColor: FOREST.border,
    color: FOREST.text,
  },
  "In Transit": {
    background: "#1A2838",
    borderColor: "#4A6B8A",
    color: "#B8CDE0",
  },
  Delivered: {
    background: FOREST.bgSoft,
    borderColor: FOREST.border,
    color: FOREST.text,
  },
  "Needs Manual Review": {
    background: "#2A2418",
    borderColor: ONE_EYRIE.gold,
    color: ONE_EYRIE.goldLight,
  },
  Cancelled: {
    background: "#1E1414",
    borderColor: "#8B5252",
    color: "#C9A8A8",
  },
  Expired: {
    background: "#333333",
    borderColor: "#555555",
    color: "#9CA3AF",
  },
};

const FALLBACK: CSSProperties = {
  background: "#1F2937",
  borderColor: "#374151",
  color: "#E5E7EB",
};

export default function LostFoundShippingBadge({
  badge,
}: LostFoundShippingBadgeProps) {
  const tone = BADGE_STYLES[badge] || FALLBACK;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        maxWidth: "100%",
        padding: "2px 8px",
        borderRadius: "999px",
        border: `1px solid ${tone.borderColor}`,
        background: tone.background,
        color: tone.color,
        fontSize: "11px",
        fontWeight: 800,
        letterSpacing: "0.2px",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {badge}
    </span>
  );
}

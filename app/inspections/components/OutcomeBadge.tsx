"use client";

import { Check, Minus, X } from "lucide-react";
import { FOREST, NEUTRAL_PILL, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type Outcome = "pass" | "fail" | "na";

const STYLES: Record<
  Outcome,
  { border: string; bg: string; text: string; label: string; Icon: typeof Check }
> = {
  pass: {
    border: FOREST.border,
    bg: FOREST.bg,
    text: FOREST.text,
    label: "Pass",
    Icon: Check,
  },
  fail: {
    border: "#8B5252",
    bg: "#1E1414",
    text: "#C9A8A8",
    label: "Fail",
    Icon: X,
  },
  na: {
    border: NEUTRAL_PILL.border,
    bg: "#242424",
    text: NEUTRAL_PILL.text,
    label: "N/A",
    Icon: Minus,
  },
};

export default function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const style = STYLES[outcome];
  const Icon = style.Icon;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "5px 10px",
        borderRadius: "999px",
        border: `1px solid ${style.border}`,
        background: style.bg,
        color: style.text,
        fontSize: "11px",
        fontWeight: 800,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {style.label}
    </span>
  );
}

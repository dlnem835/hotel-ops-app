"use client";

import Link from "next/link";
import { AttentionItem } from "../lib/operational-types";
import { FLAT_RED, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { SETTINGS_CARD_TRANSITION } from "@/app/settings/lib/settings-ui-interactions";

type NeedsAttentionSectionProps = {
  items: AttentionItem[];
};

const SEVERITY_DOT = {
  critical: "🔴",
  warning: "🟡",
} as const;

export default function NeedsAttentionSection({ items }: NeedsAttentionSectionProps) {
  return (
    <section
      style={{
        background: ONE_EYRIE.surfaceInset,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px",
      }}
    >
      <div style={{ marginBottom: "12px" }}>
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "16px" }}>
          Needs Attention
        </div>
        <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "4px" }}>
          High-priority items requiring action now
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            color: ONE_EYRIE.textMuted,
            fontSize: "13px",
            padding: "12px 4px",
            lineHeight: 1.5,
          }}
        >
          No urgent operational items right now. Systems look current.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="dashboard-clickable-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "10px",
                border: `1px solid ${
                  item.severity === "critical" ? FLAT_RED.border : ONE_EYRIE.border
                }`,
                background: ONE_EYRIE.surfacePanel,
                textDecoration: "none",
                color: ONE_EYRIE.text,
                transition: SETTINGS_CARD_TRANSITION,
              }}
            >
              <span style={{ fontSize: "12px", lineHeight: 1 }} aria-hidden>
                {SEVERITY_DOT[item.severity]}
              </span>
              <span style={{ fontWeight: 700, fontSize: "14px" }}>{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

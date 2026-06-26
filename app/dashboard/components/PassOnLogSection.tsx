"use client";

import { useState } from "react";
import Link from "next/link";
import { PassOnLogDay, PassOnLogEntry } from "../lib/operational-types";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  goldHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";
import { DashboardSectionTitle } from "./DashboardCard";

type PassOnLogSectionProps = {
  passOnLog: Record<PassOnLogDay, PassOnLogEntry[]>;
};

const TABS: { key: PassOnLogDay; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "tomorrow", label: "Tomorrow" },
];

function priorityStyle(priority: string) {
  if (priority === "Urgent") {
    return { color: FLAT_RED.text, border: FLAT_RED.border, background: FLAT_RED.bg };
  }
  if (priority === "Important") {
    return { color: ONE_EYRIE.gold, border: ONE_EYRIE.gold, background: "#2A2418" };
  }
  return { color: FOREST.text, border: FOREST.border, background: FOREST.bg };
}

export default function PassOnLogSection({ passOnLog }: PassOnLogSectionProps) {
  const [activeTab, setActiveTab] = useState<PassOnLogDay>("today");
  const entries = passOnLog[activeTab];

  return (
    <section
      style={{
        background: ONE_EYRIE.surface,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px",
        minHeight: "320px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <DashboardSectionTitle
          title="Pass-On Log"
          subtitle="Hotel communication center"
        />
        <Link
          href="/pass-on-log"
          style={{
            color: ONE_EYRIE.gold,
            fontSize: "12px",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          Open full log →
        </Link>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...SETTINGS_BUTTON_BASE,
              background: activeTab === tab.key ? ONE_EYRIE.gold : "transparent",
              color: activeTab === tab.key ? ONE_EYRIE.surface : ONE_EYRIE.text,
              border: `1px solid ${activeTab === tab.key ? ONE_EYRIE.goldLight : ONE_EYRIE.border}`,
              borderRadius: "999px",
              padding: "7px 14px",
              fontWeight: 800,
              fontSize: "12px",
            }}
            {...goldHoverHandlers(activeTab === tab.key ? "primary" : "secondary")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
        {entries.length === 0 ? (
          <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", padding: "8px 2px" }}>
            No pass-on entries for {TABS.find((tab) => tab.key === activeTab)?.label.toLowerCase()}.
          </div>
        ) : (
          entries.slice(0, 8).map((entry) => {
            const pill = priorityStyle(entry.priority);
            return (
              <Link
                key={entry.id}
                href="/pass-on-log"
                className="dashboard-clickable-card"
                style={{
                  display: "block",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: `1px solid ${ONE_EYRIE.borderDivider}`,
                  background: ONE_EYRIE.surfacePanel,
                  textDecoration: "none",
                  color: ONE_EYRIE.text,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                    alignItems: "flex-start",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "14px" }}>{entry.subject}</div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: "999px",
                      border: `1px solid ${pill.border}`,
                      background: pill.background,
                      color: pill.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.priority}
                  </span>
                </div>
                <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginBottom: "6px" }}>
                  {entry.author}
                </div>
                <div
                  style={{
                    color: ONE_EYRIE.textMuted,
                    fontSize: "12px",
                    lineHeight: 1.45,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {entry.message}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

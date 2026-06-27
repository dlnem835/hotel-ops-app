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

const PASS_ON_PANEL = {
  background: "#0B0B0B",
  border: "1px solid #2A2A2A",
} as const;

function priorityPillStyle(priority: string) {
  const color =
    priority === "Urgent"
      ? FLAT_RED.border
      : priority === "Important"
        ? ONE_EYRIE.gold
        : FOREST.border;

  const textColor =
    priority === "Urgent"
      ? FLAT_RED.text
      : priority === "Important"
        ? ONE_EYRIE.gold
        : FOREST.text;

  return {
    display: "inline-block" as const,
    color: textColor,
    border: `1px solid ${color}`,
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: "bold" as const,
    whiteSpace: "nowrap" as const,
  };
}

export default function PassOnLogSection({ passOnLog }: PassOnLogSectionProps) {
  const [activeTab, setActiveTab] = useState<PassOnLogDay>("today");
  const entries = passOnLog[activeTab];

  return (
    <section
      style={{
        ...PASS_ON_PANEL,
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
          subtitle="Shift notes and hotel communication"
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

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
        {entries.length === 0 ? (
          <div style={{ color: "#9CA3AF", fontSize: "13px", padding: "8px 2px" }}>
            No pass-on entries for {TABS.find((tab) => tab.key === activeTab)?.label.toLowerCase()}.
          </div>
        ) : (
          entries.slice(0, 8).map((entry) => (
            <Link
              key={entry.id}
              href="/pass-on-log"
              className="one-eyrie-list-row dashboard-clickable-card"
              style={{
                display: "block",
                padding: "10px 12px",
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
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    minWidth: 0,
                  }}
                >
                  {entry.subject}
                </div>
                <span style={priorityPillStyle(entry.priority)}>{entry.priority}</span>
              </div>
              <div
                style={{
                  marginTop: "3px",
                  fontSize: "12px",
                  color: "#B8C1D1",
                  marginBottom: "6px",
                }}
              >
                {entry.author}
              </div>
              <div
                style={{
                  color: "#9CA3AF",
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
          ))
        )}
      </div>
    </section>
  );
}

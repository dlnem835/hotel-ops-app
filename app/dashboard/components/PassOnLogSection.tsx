"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPassOnBusinessDateHeader, passOnDashboardDateKeys } from "@/app/lib/hotel-business-date";
import { priorityClassName } from "@/app/mobile/pass-on-log/lib/pass-on-priority";
import { PassOnLogDay, PassOnLogEntry } from "../lib/operational-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { DashboardSectionTitle } from "./DashboardCard";
import "../dashboard-pass-on-widget.css";

type PassOnLogSectionProps = {
  passOnLog: Record<PassOnLogDay, PassOnLogEntry[]>;
};

const DAY_SECTIONS: { key: PassOnLogDay; dateIndex: 0 | 1 }[] = [
  { key: "today", dateIndex: 0 },
  { key: "yesterday", dateIndex: 1 },
];

const PASS_ON_PANEL = {
  background: "#0B0B0B",
  border: "1px solid #2A2A2A",
} as const;

function authorFirstName(author: string): string {
  const trimmed = author.trim();
  if (!trimmed) return "Unknown";
  return trimmed.split(/\s+/)[0] || trimmed;
}

function formatEntryDateTime(createdAt: string): string {
  if (!createdAt) return "";
  return new Date(createdAt).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function daySectionTitle(dateKey: string): string {
  return formatPassOnBusinessDateHeader(dateKey);
}

type DashboardPassOnEntryCardProps = {
  entry: PassOnLogEntry;
  expanded: boolean;
  onToggle: () => void;
};

function DashboardPassOnEntryCard({
  entry,
  expanded,
  onToggle,
}: DashboardPassOnEntryCardProps) {
  const priority = entry.priority || "Normal";

  return (
    <div
      className={`dashboard-pass-on-entry${expanded ? " dashboard-pass-on-entry--expanded" : ""}`}
    >
      <button
        type="button"
        className="dashboard-pass-on-entry__toggle"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="dashboard-pass-on-entry__top">
          <p className="dashboard-pass-on-entry__subject">{entry.subject}</p>
          <span className={priorityClassName(priority)}>{priority}</span>
        </div>
        <div className="dashboard-pass-on-entry__meta">
          <span>{authorFirstName(entry.author)}</span>
          <span>{formatEntryDateTime(entry.createdAt)}</span>
          {entry.editedAt ? <span className="dashboard-pass-on-entry__edited">Edited</span> : null}
        </div>
      </button>
      {expanded ? (
        <div className="dashboard-pass-on-entry__body">
          {entry.editedAt ? (
            <p className="dashboard-pass-on-entry__edited-note">
              Edited {formatEntryDateTime(entry.editedAt)}
            </p>
          ) : null}
          <p className="dashboard-pass-on-entry__message">{entry.message}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function PassOnLogSection({ passOnLog }: PassOnLogSectionProps) {
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
  const dashboardDateKeys = passOnDashboardDateKeys();

  function toggleEntry(entryId: number) {
    setExpandedEntryId((current) => (current === entryId ? null : entryId));
  }

  return (
    <section
      className="dashboard-pass-on-widget"
      style={{
        ...PASS_ON_PANEL,
        borderRadius: "14px",
        padding: "15px",
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
          gap: "11px",
          marginBottom: "11px",
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <div className="dashboard-pass-on-widget__header-title">
          <DashboardSectionTitle
            title="Pass-On Log"
            subtitle="Shift notes and hotel communication"
          />
        </div>
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

      <div className="dashboard-pass-on-widget__scroll">
        {DAY_SECTIONS.map(({ key, dateIndex }) => {
          const entries = passOnLog[key];
          const sectionTitle = daySectionTitle(dashboardDateKeys[dateIndex]);

          return (
            <section key={key} className="dashboard-pass-on-widget__group">
              <h3 className="dashboard-pass-on-widget__group-title">{sectionTitle}</h3>
              {entries.length === 0 ? (
                <p className="dashboard-pass-on-widget__empty">
                  No pass-on entries for {sectionTitle.toLowerCase()}.
                </p>
              ) : (
                <div className="dashboard-pass-on-widget__list">
                  {entries.map((entry) => (
                    <DashboardPassOnEntryCard
                      key={entry.id}
                      entry={entry}
                      expanded={expandedEntryId === entry.id}
                      onToggle={() => toggleEntry(entry.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

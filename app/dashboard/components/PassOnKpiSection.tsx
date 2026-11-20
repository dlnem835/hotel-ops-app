"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PassOnDashboardKpis } from "../lib/operational-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  GOLD_OUTLINE_ACTION_BUTTON,
  goldHoverHandlers,
} from "@/app/lib/oneEyrieButtons";
import { markAllPassOnAsViewed } from "@/app/mobile/pass-on-log/lib/pass-on-shared";
import { DashboardCard, DashboardSectionTitle } from "./DashboardCard";

type PassOnKpiSectionProps = {
  kpis: PassOnDashboardKpis;
};

/** Fresh session stamp so re-clicking a KPI re-evaluates the filtered Pass-On list. */
function withKpiSession(href: string): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}s=${Date.now()}`;
}

function KpiTile({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  const hasValue = value > 0;

  return (
    <Link
      href={withKpiSession(href)}
      className={`dashboard-clickable-card dashboard-kpi-tile${
        hasValue ? " dashboard-kpi-tile--attention" : " dashboard-kpi-tile--quiet"
      }`}
      style={{
        display: "block",
        padding: "14px 12px",
        borderRadius: "12px",
        textDecoration: "none",
        background: hasValue ? ONE_EYRIE.surfaceInset : "#1A1815",
        border: `1px solid ${hasValue ? ONE_EYRIE.gold : ONE_EYRIE.border}`,
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: hasValue ? ONE_EYRIE.gold : ONE_EYRIE.textMuted,
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: hasValue ? ONE_EYRIE.text : ONE_EYRIE.textSubtle,
          fontSize: "26px",
          fontWeight: 800,
          marginTop: "8px",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </Link>
  );
}

export default function PassOnKpiSection({ kpis }: PassOnKpiSectionProps) {
  const [displayedKpis, setDisplayedKpis] = useState(kpis);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    setDisplayedKpis(kpis);
  }, [kpis]);

  async function markAllAsRead() {
    if (markingAllRead || displayedKpis.unread <= 0) return;

    const previous = displayedKpis;
    setMarkingAllRead(true);
    setDisplayedKpis({
      ...displayedKpis,
      newEntries: 0,
      unread: 0,
      newReplies: 0,
    });

    try {
      await markAllPassOnAsViewed();
    } catch (error) {
      setDisplayedKpis(previous);
      alert(
        error instanceof Error
          ? error.message
          : "Unable to mark pass-on entries as read"
      );
    } finally {
      setMarkingAllRead(false);
    }
  }

  return (
    <DashboardCard
      className={`dashboard-pass-on-kpi-card${
        displayedKpis.unread > 0 ? " dashboard-pass-on-kpi-card--has-read-all" : ""
      }`}
      style={{ position: "relative" }}
    >
      <DashboardSectionTitle
        title="Pass-On"
        subtitle="Your unread and new activity"
      />
      {displayedKpis.unread > 0 ? (
        <button
          type="button"
          className="dashboard-pass-on-read-all one-eyrie-btn one-eyrie-btn--gold-outline"
          style={{
            ...GOLD_OUTLINE_ACTION_BUTTON,
            minHeight: "36px",
            height: "36px",
            padding: "0 12px",
            fontSize: "12px",
            opacity: markingAllRead ? 0.6 : 1,
            cursor: markingAllRead ? "wait" : "pointer",
          }}
          onClick={() => void markAllAsRead()}
          disabled={markingAllRead}
          {...goldHoverHandlers("secondary", markingAllRead)}
        >
          {markingAllRead ? "Marking…" : "Read all"}
        </button>
      ) : null}
      <div
        className="dashboard-pass-on-kpi-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "10px",
        }}
      >
        <KpiTile
          label="New Entries"
          value={displayedKpis.newEntries}
          href={displayedKpis.hrefs.newEntries}
        />
        <KpiTile
          label="Unread"
          value={displayedKpis.unread}
          href={displayedKpis.hrefs.unread}
        />
        <KpiTile
          label="New Replies"
          value={displayedKpis.newReplies}
          href={displayedKpis.hrefs.newReplies}
        />
      </div>
    </DashboardCard>
  );
}

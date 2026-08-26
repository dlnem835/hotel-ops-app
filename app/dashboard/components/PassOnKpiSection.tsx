"use client";

import Link from "next/link";
import { PassOnDashboardKpis } from "../lib/operational-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { DashboardCard, DashboardSectionTitle } from "./DashboardCard";

type PassOnKpiSectionProps = {
  kpis: PassOnDashboardKpis;
};

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
      href={href}
      className="dashboard-clickable-card"
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
  return (
    <DashboardCard className="dashboard-pass-on-kpi-card">
      <DashboardSectionTitle
        title="Pass-On"
        subtitle="Your unread and new activity"
      />
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
          value={kpis.newEntries}
          href={kpis.hrefs.newEntries}
        />
        <KpiTile label="Unread" value={kpis.unread} href={kpis.hrefs.unread} />
        <KpiTile
          label="New Replies"
          value={kpis.newReplies}
          href={kpis.hrefs.newReplies}
        />
      </div>
    </DashboardCard>
  );
}

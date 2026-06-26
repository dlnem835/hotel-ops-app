"use client";

import Link from "next/link";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { DashboardCard, DashboardSectionTitle } from "./DashboardCard";

type LostFoundSummaryCardProps = {
  readyToShip: number;
  storedToday: number;
};

function SummaryLink({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="dashboard-clickable-card"
      style={{
        display: "block",
        padding: "12px",
        borderRadius: "10px",
        border: `1px solid ${ONE_EYRIE.borderDivider}`,
        background: ONE_EYRIE.surfacePanel,
        textDecoration: "none",
        color: ONE_EYRIE.text,
      }}
    >
      <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "11px", fontWeight: 700 }}>
        {label}
      </div>
      <div
        style={{
          color: ONE_EYRIE.gold,
          fontSize: "24px",
          fontWeight: 800,
          marginTop: "6px",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </Link>
  );
}

export default function LostFoundSummaryCard({
  readyToShip,
  storedToday,
}: LostFoundSummaryCardProps) {
  return (
    <DashboardCard>
      <DashboardSectionTitle title="Lost & Found" subtitle="Quick summary" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <SummaryLink
          label="Ready to Ship"
          value={readyToShip}
          href="/lost-and-found"
        />
        <SummaryLink
          label="Stored Today"
          value={storedToday}
          href="/lost-and-found"
        />
      </div>
    </DashboardCard>
  );
}

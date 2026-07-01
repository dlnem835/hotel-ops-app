"use client";

import Link from "next/link";
import { FOREST } from "@/app/lib/oneEyrieColors";
import { DashboardCard, DashboardSectionTitle } from "./DashboardCard";

type LostFoundSummaryCardProps = {
  readyToShip: number;
  storedToday: number;
};

const READY_TO_SHIP_STYLE = {
  background: FOREST.bg,
  border: `1px solid ${FOREST.border}`,
  labelColor: FOREST.text,
  valueColor: FOREST.text,
};

const STORED_TODAY_STYLE = {
  background: "#333333",
  border: "1px solid #555555",
  labelColor: "#E5E7EB",
  valueColor: "#E5E7EB",
};

function SummaryLink({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: "readyToShip" | "storedToday";
}) {
  const style = tone === "readyToShip" ? READY_TO_SHIP_STYLE : STORED_TODAY_STYLE;

  return (
    <Link
      href={href}
      className="dashboard-clickable-card"
      style={{
        display: "block",
        padding: "12px",
        borderRadius: "12px",
        textDecoration: "none",
        background: style.background,
        border: style.border,
      }}
    >
      <div style={{ color: style.labelColor, fontSize: "11px", fontWeight: 700 }}>
        {label}
      </div>
      <div
        style={{
          color: style.valueColor,
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
    <DashboardCard className="dashboard-lost-found-card">
      <DashboardSectionTitle title="Lost & Found" subtitle="Quick summary" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <SummaryLink
          label="Ready to Ship"
          value={readyToShip}
          href="/lost-and-found"
          tone="readyToShip"
        />
        <SummaryLink
          label="Stored Today"
          value={storedToday}
          href="/lost-and-found"
          tone="storedToday"
        />
      </div>
    </DashboardCard>
  );
}

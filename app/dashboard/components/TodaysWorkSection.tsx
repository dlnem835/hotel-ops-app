"use client";

import Link from "next/link";
import { TodaysWorkCard } from "../lib/operational-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type TodaysWorkSectionProps = {
  pms: TodaysWorkCard;
  rpms: TodaysWorkCard;
};

function WorkCard({
  title,
  label,
  emptyLabel,
  href,
}: {
  title: string;
  label: string | null;
  emptyLabel: string;
  href: string;
}) {
  const hasWork = Boolean(label);

  return (
    <Link
      href={href}
      className={`one-eyrie-list-row dashboard-clickable-card${hasWork ? " dashboard-todays-work-kpi-card--has-value" : ""}`}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textDecoration: "none",
        color: "inherit",
        padding: "20px 22px",
        minWidth: 0,
        minHeight: "108px",
      }}
    >
      <div className="dashboard-todays-work-card__title">
        {title}
      </div>
      <div
        style={{
          color: hasWork ? ONE_EYRIE.gold : ONE_EYRIE.textMuted,
          fontSize: hasWork ? "22px" : "15px",
          fontWeight: hasWork ? 800 : 600,
          lineHeight: 1.35,
        }}
      >
        {label ?? emptyLabel}
      </div>
    </Link>
  );
}

export default function TodaysWorkSection({ pms, rpms }: TodaysWorkSectionProps) {
  return (
    <section className="dashboard-todays-work-section">
      <div style={{ marginBottom: "12px" }}>
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "16px" }}>
          Today&apos;s Work
        </div>
        <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "4px" }}>
          What must be completed today
        </div>
      </div>

      <div
        className="dashboard-todays-work-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(280px, 1fr))",
          gap: "12px",
        }}
      >
        <WorkCard
          title="Today's PMs"
          label={pms.label}
          emptyLabel="No PMs Due Today"
          href={pms.href}
        />
        <WorkCard
          title="Today's RPMs"
          label={rpms.label}
          emptyLabel="No RPMs Due Today"
          href={rpms.href}
        />
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { PastDueSummary } from "../lib/operational-types";
import { FLAT_RED, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type PastDueSummaryBarProps = {
  pastDue: PastDueSummary;
};

function PastDueLink({
  label,
  count,
  href,
}: {
  label: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="dashboard-clickable-card"
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: "6px",
        padding: "8px 12px",
        borderRadius: "12px",
        textDecoration: "none",
        background: FLAT_RED.bg,
        border: `1px solid ${FLAT_RED.border}`,
        color: FLAT_RED.text,
      }}
    >
      <span style={{ color: FLAT_RED.text, fontSize: "12px", fontWeight: 700, opacity: 0.9 }}>
        {label}:
      </span>
      <span
        style={{
          color: count > 0 ? FLAT_RED.text : ONE_EYRIE.textMuted,
          fontSize: "14px",
          fontWeight: 800,
        }}
      >
        {count}
      </span>
    </Link>
  );
}

export default function PastDueSummaryBar({ pastDue }: PastDueSummaryBarProps) {
  const total = pastDue.pms + pastDue.vrInspections + pastDue.rpmInspections;

  return (
    <section
      className="dashboard-row-card"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "10px 14px",
        padding: "12px 14px",
        borderRadius: "12px",
      }}
    >
      <div
        style={{
          color: ONE_EYRIE.textSubtle,
          fontSize: "12px",
          fontWeight: 800,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginRight: "4px",
        }}
      >
        Past Due
      </div>

      {total === 0 ? (
        <span style={{ color: ONE_EYRIE.textMuted, fontSize: "12px" }}>
          Nothing overdue right now
        </span>
      ) : (
        <>
          <PastDueLink label="PMs" count={pastDue.pms} href={pastDue.hrefs.pms} />
          <PastDueLink
            label="VR Inspections"
            count={pastDue.vrInspections}
            href={pastDue.hrefs.vrInspections}
          />
          <PastDueLink
            label="RPMs"
            count={pastDue.rpmInspections}
            href={pastDue.hrefs.rpmInspections}
          />
        </>
      )}
    </section>
  );
}

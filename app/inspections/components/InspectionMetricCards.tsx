"use client";

import { DashboardMetrics } from "../lib/inspection-types";
import { FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import RpmComplianceCard from "./RpmComplianceCard";

type InspectionMetricCardsProps = {
  metrics: DashboardMetrics;
  program: "VR" | "RPM";
};

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: ONE_EYRIE.surface,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px 18px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: ONE_EYRIE.textSubtle,
          fontSize: "12px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: accent || ONE_EYRIE.text,
          fontSize: "24px",
          fontWeight: 800,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "12px", marginTop: "6px" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function InspectionMetricCards({
  metrics,
  program,
}: InspectionMetricCardsProps) {
  if (program === "RPM") {
    return (
      <div
        className="inspections-rpm-kpi-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr)) minmax(0, 1.5fr)",
          gap: "12px",
          marginBottom: "18px",
        }}
      >
        <MetricCard
          label="RPM Inspected"
          value={`${metrics.rpmInspected} / ${metrics.rpmTotal}`}
          accent={ONE_EYRIE.gold}
        />
        <MetricCard
          label="Remaining"
          value={String(metrics.remaining)}
          sub="This period"
        />
        <MetricCard
          label="Average Score"
          value={metrics.averageScore === null ? "—" : `${metrics.averageScore}%`}
        />
        <RpmComplianceCard compliance={metrics.rpmCompliance} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "12px",
        marginBottom: "18px",
      }}
    >
      <MetricCard
        label="VR Inspected"
        value={`${metrics.vrInspected} / ${metrics.vrTotal}`}
        accent={FOREST.text}
      />
      <MetricCard
        label="RPM Inspected"
        value={`${metrics.rpmInspected} / ${metrics.rpmTotal}`}
        accent={ONE_EYRIE.gold}
      />
      <MetricCard label="Remaining" value={String(metrics.remaining)} sub={`${program} program`} />
      <MetricCard
        label="Coverage %"
        value={`${metrics.coveragePercent}%`}
        accent={FOREST.text}
      />
      <MetricCard
        label="Average Score"
        value={metrics.averageScore === null ? "—" : `${metrics.averageScore}%`}
      />
      <MetricCard
        label="Low Score Rooms"
        value={String(metrics.lowScoreRooms)}
        accent={metrics.lowScoreRooms > 0 ? "#C9A8A8" : ONE_EYRIE.text}
      />
    </div>
  );
}

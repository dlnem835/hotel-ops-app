"use client";

import { MaintenanceMetrics } from "../lib/maintenance-types";
import { FLAT_RED, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import PmHealthReportTile from "./PmHealthReportTile";

type MaintenanceMetricCardsProps = {
  metrics: MaintenanceMetrics;
  onPmHealthClick?: () => void;
  className?: string;
};

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="maintenance-metric-card"
      style={{
        background: ONE_EYRIE.listRow,
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
    </div>
  );
}

export default function MaintenanceMetricCards({
  metrics,
  onPmHealthClick,
  className,
}: MaintenanceMetricCardsProps) {
  return (
    <div className={`maintenance-metric-cards${className ? ` ${className}` : ""}`}>
      <MetricCard
        label="Open Work Orders"
        value={String(metrics.openWorkOrders)}
        accent={metrics.openWorkOrders > 0 ? FLAT_RED.text : ONE_EYRIE.text}
      />
      <MetricCard
        label="Past Due PMs"
        value={String(metrics.pastDuePms)}
        accent={metrics.pastDuePms > 0 ? FLAT_RED.text : ONE_EYRIE.text}
      />
      <MetricCard
        label="Due Today"
        value={String(metrics.dueTodayPms)}
        accent={metrics.dueTodayPms > 0 ? ONE_EYRIE.gold : ONE_EYRIE.text}
      />
      <MetricCard
        label="Upcoming This Week"
        value={String(metrics.upcomingThisWeekPms)}
      />
      {onPmHealthClick ? (
        <PmHealthReportTile onClick={onPmHealthClick} />
      ) : null}
      <MetricCard label="PMs Completed" value={String(metrics.completedMtd)} />
    </div>
  );
}

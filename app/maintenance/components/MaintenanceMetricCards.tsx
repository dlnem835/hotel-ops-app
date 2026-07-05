"use client";

import { MaintenanceMetrics } from "../lib/maintenance-types";
import { FLAT_RED, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type MaintenanceMetricCardsProps = {
  metrics: MaintenanceMetrics;
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
      className="maintenance-metric-card maintenance-pm-metric-card"
      style={{
        background: ONE_EYRIE.listRow,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "20px 22px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: ONE_EYRIE.textSubtle,
          fontSize: "12px",
          fontWeight: 700,
          marginBottom: "10px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: accent || ONE_EYRIE.text,
          fontSize: "28px",
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
  className,
}: MaintenanceMetricCardsProps) {
  return (
    <div className={`maintenance-metric-cards maintenance-pm-metric-cards${className ? ` ${className}` : ""}`}>
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
      <MetricCard label="PMs Completed" value={String(metrics.completedMtd)} />
      <MetricCard
        label="Total Open PMs"
        value={String(
          metrics.totalOpenPms ?? metrics.pastDuePms + metrics.dueTodayPms
        )}
      />
    </div>
  );
}

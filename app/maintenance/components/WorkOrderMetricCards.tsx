"use client";

import { FLAT_RED, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type WorkOrderMetricCardsProps = {
  openWorkOrders: number;
  urgentWorkOrders: number;
  className?: string;
};

function MetricCard({
  label,
  value,
  accent,
  placeholder,
}: {
  label: string;
  value: string;
  accent?: string;
  placeholder?: boolean;
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
        opacity: placeholder ? 0.72 : 1,
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
          color: accent || (placeholder ? ONE_EYRIE.textMuted : ONE_EYRIE.text),
          fontSize: placeholder ? "20px" : "24px",
          fontWeight: 800,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function WorkOrderMetricCards({
  openWorkOrders,
  urgentWorkOrders,
  className,
}: WorkOrderMetricCardsProps) {
  return (
    <div
      className={`maintenance-metric-cards maintenance-wo-metric-cards${className ? ` ${className}` : ""}`}
    >
      <MetricCard
        label="Open Work Orders"
        value={String(openWorkOrders)}
        accent={openWorkOrders > 0 ? FLAT_RED.text : ONE_EYRIE.text}
      />
      <MetricCard
        label="Urgent Work Orders"
        value={String(urgentWorkOrders)}
        accent={urgentWorkOrders > 0 ? FLAT_RED.text : ONE_EYRIE.text}
      />
      <MetricCard label="Average Open Days" value="—" placeholder />
    </div>
  );
}

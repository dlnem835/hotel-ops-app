"use client";

import { WorkOrder } from "../lib/maintenance-types";
import { FLAT_RED, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type WorkOrderMetricCardsProps = {
  openWorkOrders: number;
  urgentWorkOrders: number;
  workOrders: WorkOrder[];
  className?: string;
};

function formatAvgOpenDays(workOrders: WorkOrder[]): string {
  if (workOrders.length === 0) return "0";

  const now = Date.now();
  const totalDays = workOrders.reduce((sum, order) => {
    const created = new Date(order.createdAt).getTime();
    if (Number.isNaN(created)) return sum;
    return sum + Math.max(0, (now - created) / (1000 * 60 * 60 * 24));
  }, 0);

  return (totalDays / workOrders.length).toFixed(1);
}

function CompactKpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="maintenance-wo-kpi-card">
      <div className="maintenance-wo-kpi-card__label">{label}</div>
      <div
        className="maintenance-wo-kpi-card__value"
        style={{ color: accent || ONE_EYRIE.text }}
      >
        {value}
      </div>
    </div>
  );
}

export default function WorkOrderMetricCards({
  openWorkOrders,
  urgentWorkOrders,
  workOrders,
  className,
}: WorkOrderMetricCardsProps) {
  const avgOpenDays = formatAvgOpenDays(workOrders);

  return (
    <div
      className={`maintenance-wo-kpi-cards${className ? ` ${className}` : ""}`}
    >
      <CompactKpiCard
        label="Open"
        value={String(openWorkOrders)}
        accent={openWorkOrders > 0 ? FLAT_RED.text : ONE_EYRIE.text}
      />
      <CompactKpiCard
        label="Urgent"
        value={String(urgentWorkOrders)}
        accent={urgentWorkOrders > 0 ? FLAT_RED.text : ONE_EYRIE.text}
      />
      <CompactKpiCard label="Avg Open Days" value={avgOpenDays} />
    </div>
  );
}

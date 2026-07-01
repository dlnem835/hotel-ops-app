"use client";

import { ChevronRight } from "lucide-react";
import { PmPriorityQueueItem } from "../lib/maintenance-types";
import { formatPmTileStatusLine } from "../lib/pm-urgency";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import "@/app/components/dashboard-list-card.css";

type Next3PmsPanelProps = {
  items: PmPriorityQueueItem[];
  onStartPm: (item: PmPriorityQueueItem) => void;
};

function areaLabel(item: PmPriorityQueueItem): string {
  if (item.areaName && item.assetLabel) {
    return `${item.areaName} · ${item.assetLabel}`;
  }
  return item.areaName || item.assetLabel || "Property-wide";
}

export default function Next3PmsPanel({ items, onStartPm }: Next3PmsPanelProps) {
  return (
    <div
      style={{
        background: ONE_EYRIE.surface,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div>
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
          Next 3 PMs
        </div>
        <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "4px" }}>
          Most urgent · past due → today → tomorrow → upcoming
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", padding: "12px 0" }}>
          No urgent PMs right now. Preventive maintenance is current.
        </div>
      ) : (
        <div className="dashboard-list-panel__rows">
          {items.map((item, index) => (
            <div
              key={`${item.assignmentId}-${item.nextDueDate}`}
              role="button"
              tabIndex={0}
              className="dashboard-list-card"
              onClick={() => onStartPm(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onStartPm(item);
                }
              }}
            >
              <div className="dashboard-list-card__body">
                <div className="dashboard-list-card__title">
                  {index + 1}. {item.templateName}
                </div>
                <div className="dashboard-list-card__location">{areaLabel(item)}</div>
                <div className="dashboard-list-card__meta">
                  {formatPmTileStatusLine(item.urgency, item.nextDueDate)}
                </div>
              </div>
              <ChevronRight size={18} aria-hidden className="dashboard-list-card__chevron" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

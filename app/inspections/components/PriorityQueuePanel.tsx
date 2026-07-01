"use client";

import { ChevronRight } from "lucide-react";
import { PriorityQueueItem } from "../lib/inspection-types";
import { formatInspectionAgeLabel } from "../lib/inspection-age";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import "@/app/components/dashboard-list-card.css";

type PriorityQueuePanelProps = {
  items: PriorityQueueItem[];
  program: "VR" | "RPM";
  onInspectRoom: (areaId: number) => void;
};

function statusLine(item: PriorityQueueItem): string {
  return formatInspectionAgeLabel(item.neverInspected, item.lastCompletedAt);
}

export default function PriorityQueuePanel({
  items,
  program,
  onInspectRoom,
}: PriorityQueuePanelProps) {
  return (
    <div
      className="inspections-priority-queue-panel"
      style={{
        background: ONE_EYRIE.surface,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px",
      }}
    >
      <div>
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
          Priority Queue
        </div>
        <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "4px" }}>
          {program === "VR" ? "Vacant Ready / Stayover" : "RPM"} · Most overdue
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", padding: "12px 0" }}>
          No priority rooms right now. All guest rooms are current.
        </div>
      ) : (
        <div className="dashboard-list-panel__rows">
          {items.map((item, index) => (
            <div
              key={item.areaId}
              role="button"
              tabIndex={0}
              className="dashboard-list-card"
              onClick={() => onInspectRoom(item.areaId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onInspectRoom(item.areaId);
                }
              }}
            >
              <div className="dashboard-list-card__body">
                <div className="dashboard-list-card__title">
                  {index + 1}. Room {item.name}
                </div>
                <div className="dashboard-list-card__meta">{statusLine(item)}</div>
              </div>
              <ChevronRight size={18} aria-hidden className="dashboard-list-card__chevron" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { PriorityQueueItem } from "../lib/inspection-types";
import { formatInspectionAgeLabel } from "../lib/inspection-age";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  forestOutlineHoverHandlers,
  FOREST_OUTLINE_BUTTON,
} from "@/app/settings/lib/settings-ui-interactions";

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
        items.map((item, index) => (
          <div
            key={item.areaId}
            style={{
              border: `1px solid ${ONE_EYRIE.border}`,
              borderRadius: "10px",
              padding: "12px",
              background: ONE_EYRIE.surfacePanel,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ color: ONE_EYRIE.text, fontWeight: 800, fontSize: "14px" }}>
                  {index + 1}. Room {item.name}
                </div>
                <div
                  style={{
                    color: ONE_EYRIE.textMuted,
                    fontSize: "12px",
                    marginTop: "6px",
                    lineHeight: 1.45,
                  }}
                >
                  {statusLine(item)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onInspectRoom(item.areaId)}
                style={FOREST_OUTLINE_BUTTON}
                {...forestOutlineHoverHandlers()}
              >
                Inspect
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

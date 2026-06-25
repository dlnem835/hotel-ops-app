"use client";

import { PmPriorityQueueItem } from "../lib/maintenance-types";
import { formatPmTileStatusLine } from "../lib/pm-urgency";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  forestOutlineHoverHandlers,
  FOREST_OUTLINE_BUTTON,
} from "@/app/settings/lib/settings-ui-interactions";

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
        items.map((item, index) => (
          <div
            key={`${item.assignmentId}-${item.nextDueDate}`}
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
                  {index + 1}. {item.templateName}
                </div>
                <div
                  style={{
                    color: ONE_EYRIE.textMuted,
                    fontSize: "12px",
                    marginTop: "6px",
                    lineHeight: 1.45,
                  }}
                >
                  {areaLabel(item)}
                </div>
                <div
                  style={{
                    color: ONE_EYRIE.textSubtle,
                    fontSize: "12px",
                    marginTop: "4px",
                  }}
                >
                  {formatPmTileStatusLine(
                    item.urgency,
                    item.nextDueDate
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onStartPm(item)}
                style={FOREST_OUTLINE_BUTTON}
                {...forestOutlineHoverHandlers()}
              >
                Start PM
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

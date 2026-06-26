"use client";

import { InspectorRanking } from "../lib/inspection-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type TopInspectorsPanelProps = {
  inspectors: InspectorRanking[];
  periodLabel: string;
};

export default function TopInspectorsPanel({
  inspectors,
  periodLabel,
}: TopInspectorsPanelProps) {
  return (
    <div
      style={{
        background: ONE_EYRIE.surfaceInset,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "14px",
        minWidth: 0,
      }}
    >
      <div style={{ marginBottom: "12px" }}>
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
          Top Inspectors
        </div>
        <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "11px", marginTop: "3px" }}>
          {periodLabel}
        </div>
      </div>

      {inspectors.length === 0 ? (
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "12px", lineHeight: 1.5 }}>
          No completed inspections in this period yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {inspectors.map((entry, index) => (
            <div
              key={entry.inspectorId}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                background: ONE_EYRIE.surfacePanel,
                border: `1px solid ${ONE_EYRIE.borderDivider}`,
              }}
            >
              <div style={{ color: ONE_EYRIE.text, fontWeight: 800, fontSize: "13px" }}>
                {index + 1}. {entry.name}
              </div>
              <div
                style={{
                  color: ONE_EYRIE.textMuted,
                  fontSize: "12px",
                  fontWeight: 700,
                  marginTop: "4px",
                }}
              >
                {entry.inspectionCount} inspection
                {entry.inspectionCount === 1 ? "" : "s"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

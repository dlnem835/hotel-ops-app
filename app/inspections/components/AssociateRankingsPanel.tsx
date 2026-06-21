"use client";

import { HousekeeperRanking } from "../lib/inspection-types";
import { FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type AssociateRankingsPanelProps = {
  rankings: HousekeeperRanking[];
  program: "VR" | "RPM";
};

export default function AssociateRankingsPanel({
  rankings,
  program,
}: AssociateRankingsPanelProps) {
  return (
    <div
      style={{
        marginTop: "14px",
        background: ONE_EYRIE.surfaceInset,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "14px",
      }}
    >
      <div style={{ marginBottom: "10px" }}>
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
          Associate Rankings
        </div>
        <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "11px", marginTop: "3px" }}>
          {program === "VR" ? "VR / SO" : "RPM"} · selected period
        </div>
      </div>

      {rankings.length === 0 ? (
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "12px", lineHeight: 1.5 }}>
          No associate-linked inspections in this period yet.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "8px",
          }}
        >
          {rankings.map((entry, index) => (
            <div
              key={entry.associateId}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "4px 10px",
                padding: "10px",
                borderRadius: "8px",
                background: ONE_EYRIE.surfacePanel,
                border: `1px solid ${ONE_EYRIE.borderDivider}`,
              }}
            >
              <div style={{ color: ONE_EYRIE.text, fontWeight: 800, fontSize: "13px" }}>
                {index + 1}. {entry.name}
              </div>
              <div style={{ color: FOREST.text, fontWeight: 800, fontSize: "12px" }}>
                {entry.averageScore === null ? "—" : `${entry.averageScore}%`}
              </div>
              <div
                style={{
                  gridColumn: "1 / -1",
                  color: ONE_EYRIE.textSubtle,
                  fontSize: "11px",
                  lineHeight: 1.45,
                }}
              >
                {entry.roomsInspected} room{entry.roomsInspected === 1 ? "" : "s"} ·{" "}
                {entry.coveragePercent}% coverage
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

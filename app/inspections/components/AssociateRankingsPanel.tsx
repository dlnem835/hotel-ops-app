"use client";

import { HousekeeperRanking } from "../lib/inspection-types";
import { FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type AssociateRankingsPanelProps = {
  rankings: HousekeeperRanking[];
  program: "VR" | "RPM";
  periodLabel: string;
};

export default function AssociateRankingsPanel({
  rankings,
  program,
  periodLabel,
}: AssociateRankingsPanelProps) {
  return (
    <div
      className="inspection-rankings-panel"
      style={{
        background: ONE_EYRIE.surfaceInset,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "14px",
        minWidth: 0,
      }}
    >
      <div style={{ marginBottom: "12px" }}>
        <div className="inspection-rankings-title" style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
          Associate Rankings
        </div>
        <div className="inspection-rankings-sub" style={{ color: ONE_EYRIE.textSubtle, fontSize: "11px", marginTop: "3px" }}>
          {program === "VR" ? "VR / SO" : "RPM"} · {periodLabel}
        </div>
      </div>

      {rankings.length === 0 ? (
        <div className="inspection-rankings-empty" style={{ color: ONE_EYRIE.textMuted, fontSize: "12px", lineHeight: 1.5 }}>
          No associate-linked inspections in this period yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {rankings.map((entry, index) => (
            <div
              key={entry.associateId}
              className="inspection-rankings-row"
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                background: ONE_EYRIE.surfacePanel,
                border: `1px solid ${ONE_EYRIE.borderDivider}`,
              }}
            >
              <div className="inspection-rankings-name" style={{ color: ONE_EYRIE.text, fontWeight: 800, fontSize: "13px" }}>
                {index + 1}. {entry.name}
              </div>
              <div
                className="inspection-rankings-score"
                style={{
                  color: FOREST.text,
                  fontWeight: 800,
                  fontSize: "13px",
                  marginTop: "4px",
                }}
              >
                {entry.averageScore === null ? "—" : `${entry.averageScore}%`}
              </div>
              <div
                className="inspection-rankings-meta"
                style={{
                  color: ONE_EYRIE.textSubtle,
                  fontSize: "11px",
                  lineHeight: 1.45,
                  marginTop: "4px",
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

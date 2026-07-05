"use client";

import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type PmHealthReportTileProps = {
  onClick: () => void;
};

export default function PmHealthReportTile({ onClick }: PmHealthReportTileProps) {
  return (
    <button
      type="button"
      className="maintenance-metric-card maintenance-pm-health-report-tile"
      onClick={onClick}
      style={{
        background: ONE_EYRIE.listRow,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px 18px",
        minWidth: 0,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div
        className="maintenance-pm-health-report-title"
        style={{
          color: ONE_EYRIE.text,
          fontSize: "15px",
          fontWeight: 800,
          lineHeight: 1.15,
          marginBottom: "4px",
        }}
      >
        PM Health Check
      </div>
      <div
        className="maintenance-pm-health-report-subtext"
        style={{
          color: ONE_EYRIE.textSubtle,
          fontSize: "12px",
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        View Details --&gt;
      </div>
    </button>
  );
}

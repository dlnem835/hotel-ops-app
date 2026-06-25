"use client";

import { EngineeringPerformance } from "../lib/maintenance-types";
import { getPmComplianceGrade } from "../lib/pm-compliance-grade";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type EngineeringPerformancePanelProps = {
  performance: EngineeringPerformance;
};

export default function EngineeringPerformancePanel({
  performance,
}: EngineeringPerformancePanelProps) {
  const grade = getPmComplianceGrade(performance.compliancePercent);
  const clampedPercent = Math.max(0, Math.min(100, performance.compliancePercent));

  return (
    <div
      style={{
        background: ONE_EYRIE.surface,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px",
      }}
    >
      <div style={{ marginBottom: "14px" }}>
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
          Engineering Performance
        </div>
      </div>

      <div
        style={{
          textAlign: "center",
          padding: "20px 16px",
          borderRadius: "12px",
          background: grade.background,
          border: `1px solid ${grade.border}`,
        }}
      >
        <div
          style={{
            color: ONE_EYRIE.textSubtle,
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "10px",
          }}
        >
          PM Compliance
        </div>
        <div
          style={{
            color: grade.accent,
            fontSize: "42px",
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {performance.compliancePercent}%
        </div>
        <div
          style={{
            color: grade.accent,
            fontSize: "15px",
            fontWeight: 800,
            marginTop: "10px",
            marginBottom: "14px",
          }}
        >
          {grade.label}
        </div>

        <div
          style={{
            height: "8px",
            borderRadius: "999px",
            background: ONE_EYRIE.black,
            border: `1px solid ${ONE_EYRIE.borderDivider}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${clampedPercent}%`,
              height: "100%",
              borderRadius: "999px",
              background: grade.progressFill,
              transition: "width 0.35s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

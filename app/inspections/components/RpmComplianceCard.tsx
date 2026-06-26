"use client";

import { RpmCycleCompliance } from "../lib/inspection-types";
import { getPmComplianceGrade } from "@/app/maintenance/lib/pm-compliance-grade";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type RpmComplianceCardProps = {
  compliance: RpmCycleCompliance;
};

export default function RpmComplianceCard({ compliance }: RpmComplianceCardProps) {
  const grade = getPmComplianceGrade(compliance.compliancePercent);
  const clampedPercent = Math.max(0, Math.min(100, compliance.compliancePercent));

  return (
    <div
      style={{
        background: ONE_EYRIE.surface,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px 18px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: ONE_EYRIE.textSubtle,
          fontSize: "12px",
          fontWeight: 700,
          marginBottom: "8px",
        }}
      >
        RPM Compliance
      </div>

      <div
        style={{
          color: grade.accent,
          fontSize: "28px",
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: "10px",
        }}
      >
        {compliance.compliancePercent}%
      </div>

      <div
        style={{
          height: "6px",
          borderRadius: "999px",
          background: ONE_EYRIE.black,
          border: `1px solid ${ONE_EYRIE.borderDivider}`,
          overflow: "hidden",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            width: `${clampedPercent}%`,
            height: "100%",
            borderRadius: "999px",
            background: grade.progressFill,
            transition: "width 0.35s ease, background 0.35s ease",
          }}
        />
      </div>

      <div
        style={{
          color: ONE_EYRIE.textMuted,
          fontSize: "11px",
          lineHeight: 1.4,
        }}
      >
        {compliance.completedCount} of {compliance.requiredCount} completed this cycle
      </div>
    </div>
  );
}

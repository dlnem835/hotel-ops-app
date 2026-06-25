"use client";

import { useState } from "react";
import {
  EngineeringPerformance,
  PM_COMPLIANCE_PERIODS,
  PmCompliancePeriod,
} from "../lib/maintenance-types";
import { getPmComplianceGrade } from "../lib/pm-compliance-grade";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type EngineeringPerformancePanelProps = {
  performance: EngineeringPerformance;
};

const PERIOD_LABELS: Record<PmCompliancePeriod, string> = {
  mtd: "MTD",
  qtd: "QTD",
  ytd: "YTD",
};

export default function EngineeringPerformancePanel({
  performance,
}: EngineeringPerformancePanelProps) {
  const [period, setPeriod] = useState<PmCompliancePeriod>("mtd");
  const { completionRate, onTimeRate } = performance.performanceByPeriod[period];
  const grade = getPmComplianceGrade(completionRate);
  const clampedPercent = Math.max(0, Math.min(100, completionRate));

  return (
    <div
      style={{
        background: ONE_EYRIE.surface,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "14px",
        }}
      >
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
          Engineering Performance
        </div>
        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value as PmCompliancePeriod)}
          aria-label="PM completion timeframe"
          style={{
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 8px",
            borderRadius: "8px",
            border: `1px solid ${ONE_EYRIE.border}`,
            background: ONE_EYRIE.surfaceInset,
            color: ONE_EYRIE.text,
            cursor: "pointer",
          }}
        >
          {PM_COMPLIANCE_PERIODS.map((entry) => (
            <option key={entry} value={entry}>
              {PERIOD_LABELS[entry]}
            </option>
          ))}
        </select>
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
          PM Completion Rate
        </div>
        <div
          style={{
            color: grade.accent,
            fontSize: "42px",
            fontWeight: 800,
            lineHeight: 1,
            marginBottom: "12px",
          }}
        >
          {completionRate}%
        </div>

        <div style={{ marginBottom: "14px" }}>
          <div
            style={{
              color: ONE_EYRIE.textSubtle,
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            On-Time Compliance
          </div>
          <div
            style={{
              color: ONE_EYRIE.textMuted,
              fontSize: "20px",
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {onTimeRate === null ? "—" : `${onTimeRate}%`}
          </div>
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
              transition: "width 0.35s ease, background 0.35s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

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

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
      <div
        style={{
          color: ONE_EYRIE.textSubtle,
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: ONE_EYRIE.text,
          fontSize: "22px",
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function EngineeringPerformancePanel({
  performance,
}: EngineeringPerformancePanelProps) {
  const [period, setPeriod] = useState<PmCompliancePeriod>("ytd");
  const { healthPercent, currentPms, pastDueCount, incompleteCycles } =
    performance.pmHealth;
  const { completionRate } = performance.performanceByPeriod[period];
  const grade = getPmComplianceGrade(healthPercent);
  const clampedPercent = Math.max(0, Math.min(100, healthPercent));

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
          aria-label="PM health timeframe"
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
          PM Health
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
          {healthPercent}%
        </div>

        <div
          style={{
            height: "8px",
            borderRadius: "999px",
            background: ONE_EYRIE.black,
            border: `1px solid ${ONE_EYRIE.borderDivider}`,
            overflow: "hidden",
            marginBottom: "16px",
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
            display: "flex",
            gap: "8px",
            marginBottom: "14px",
          }}
        >
          <StatItem label="Current PMs" value={currentPms} />
          <StatItem label="Past Due" value={pastDueCount} />
          <StatItem label="Incomplete Cycles" value={incompleteCycles} />
        </div>

        <div
          style={{
            color: ONE_EYRIE.textSubtle,
            fontSize: "10px",
            fontWeight: 600,
          }}
        >
          {PERIOD_LABELS[period]} completion: {completionRate}%
        </div>
      </div>
    </div>
  );
}

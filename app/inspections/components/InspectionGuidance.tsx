"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { GENERAL_INSPECTION_STANDARDS } from "@/app/inspections/lib/housekeeping-vacant-ready-ui";

export function GeneralInspectionStandards() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      style={{
        marginBottom: "14px",
        border: `1px solid ${ONE_EYRIE.borderDivider}`,
        borderRadius: "10px",
        background: ONE_EYRIE.surfaceInset,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        style={{
          width: "100%",
          padding: "11px 14px",
          border: 0,
          background: "transparent",
          color: ONE_EYRIE.textSubtle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          cursor: "pointer",
          font: "inherit",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: "13px", fontWeight: 700 }}>General Inspection Standards</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: ONE_EYRIE.gold,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 160ms ease",
          }}
        />
      </button>

      {expanded ? (
        <div
          style={{
            borderTop: `1px solid ${ONE_EYRIE.borderDivider}`,
            padding: "10px 14px 12px",
            color: ONE_EYRIE.textMuted,
            fontSize: "12px",
            lineHeight: 1.45,
          }}
        >
          <div>Unless otherwise noted, inspect each item for:</div>
          <ul
            style={{
              columns: "2 150px",
              margin: "7px 0 0",
              paddingLeft: "18px",
            }}
          >
            {GENERAL_INSPECTION_STANDARDS.map((standard) => (
              <li key={standard} style={{ breakInside: "avoid", marginBottom: "2px" }}>
                {standard}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

type InspectionItemGuidanceHeadingProps = {
  label: string;
  inspect: readonly string[];
  expanded: boolean;
  onToggle: () => void;
};

export function InspectionItemGuidanceHeading({
  label,
  inspect,
  expanded,
  onToggle,
}: InspectionItemGuidanceHeadingProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        style={{
          border: 0,
          padding: 0,
          background: "transparent",
          color: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          cursor: "pointer",
          font: "inherit",
          fontWeight: "inherit",
          lineHeight: "inherit",
          textAlign: "left",
        }}
      >
        <span>{label}</span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: ONE_EYRIE.gold,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 160ms ease",
          }}
        />
      </button>

      {expanded ? (
        <div
          style={{
            marginTop: "6px",
            color: ONE_EYRIE.textMuted,
            fontSize: "12px",
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          <span style={{ color: ONE_EYRIE.textSubtle, fontWeight: 700 }}>Inspect: </span>
          {inspect.join(" · ")}
        </div>
      ) : null}
    </>
  );
}

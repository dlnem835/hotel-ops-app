"use client";

import { AlertTriangle } from "lucide-react";
import { AreaPmGridSummary } from "@/app/maintenance/lib/pm-types";
import {
  formatNextDueLabel,
  getDueStatus,
} from "@/app/maintenance/lib/schedule-engine";
import {
  getAreaTypeAbbrev,
  getTileLabel,
  getTileStyle,
} from "../lib/buildings-areas";
import { BuildingArea } from "../lib/buildings-types";

type PmAssignmentGridProps = {
  areas: BuildingArea[];
  summaries: AreaPmGridSummary[];
};

function MarkerDot({ marker }: { marker: AreaPmGridSummary["marker"] }) {
  if (marker === "missing") {
    return (
      <AlertTriangle
        size={11}
        color="#9CA3AF"
        style={{ position: "absolute", top: "4px", right: "4px" }}
      />
    );
  }

  if (marker === "none") {
    return null;
  }

  const color = marker === "overdue" ? "#E57373" : "#E0C47B";

  return (
    <span
      style={{
        position: "absolute",
        top: "5px",
        right: "5px",
        width: "8px",
        height: "8px",
        borderRadius: "999px",
        background: color,
        boxShadow: `0 0 6px ${color}`,
      }}
    />
  );
}

function buildTooltip(summary: AreaPmGridSummary): string {
  const lines = [summary.areaName];

  if (summary.marker === "missing") {
    lines.push("No PM assigned");
    return lines.join("\n");
  }

  lines.push(
    `${summary.assignedCount} PM template${summary.assignedCount === 1 ? "" : "s"} assigned`
  );

  if (summary.nextDueDate) {
    const status = getDueStatus(summary.nextDueDate);
    lines.push(`Next PM: ${formatNextDueLabel(summary.nextDueDate, status)}`);
  }

  if (summary.overdueCount > 0) {
    lines.push(
      `${summary.overdueCount} overdue PM${summary.overdueCount === 1 ? "" : "s"}`
    );
  }

  return lines.join("\n");
}

export function PmGridLegend() {
  const items = [
    { label: "Current", marker: "none" as const },
    { label: "Due soon", marker: "due_soon" as const },
    { label: "Overdue", marker: "overdue" as const },
    { label: "No PM assigned", marker: "missing" as const },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        marginBottom: "12px",
        fontSize: "12px",
        color: "#9CA3AF",
        fontWeight: 600,
      }}
    >
      {items.map((item) => (
        <span
          key={item.label}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          {item.marker === "missing" ? (
            <AlertTriangle size={12} color="#9CA3AF" />
          ) : item.marker === "none" ? (
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "3px",
                border: "1px solid #3d6b4f",
                background: "rgba(28, 52, 40, 0.72)",
              }}
            />
          ) : (
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "999px",
                background: item.marker === "overdue" ? "#E57373" : "#E0C47B",
              }}
            />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default function PmAssignmentGrid({
  areas,
  summaries,
}: PmAssignmentGridProps) {
  const summaryByArea = new Map(summaries.map((entry) => [entry.areaId, entry]));

  const gridAreas = areas
    .filter((area) => area.area_type !== "Guest Room")
    .sort((a, b) => a.name.localeCompare(b.name));

  if (gridAreas.length === 0) {
    return (
      <div style={emptyGrid}>
        No building areas yet. Add areas in Rooms &amp; Areas first.
      </div>
    );
  }

  return (
    <div style={gridWrap}>
      {gridAreas.map((area) => {
        const style = getTileStyle(area.area_type, area.status);
        const label = getTileLabel(area.name, area.area_type);
        const abbrev = getAreaTypeAbbrev(area.area_type);
        const summary = summaryByArea.get(area.id) || {
          areaId: area.id,
          areaName: area.name,
          areaType: area.area_type,
          assignedCount: 0,
          nextDueDate: null,
          overdueCount: 0,
          marker: "missing" as const,
        };

        return (
          <div
            key={area.id}
            title={buildTooltip(summary)}
            style={{
              ...tile,
              position: "relative",
              background: style.background,
              borderColor: style.border,
              color: style.color,
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <MarkerDot marker={summary.marker} />
            {style.showTypeLabel && abbrev && (
              <span style={typeBadge}>{abbrev}</span>
            )}
            <span style={tileLabel}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

const gridWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
  gap: "8px",
  padding: "16px",
  background: "#151515",
  border: "1px solid #3A352E",
  borderRadius: "14px",
  maxHeight: "420px",
  overflowY: "auto",
};

const tile: React.CSSProperties = {
  minHeight: "52px",
  border: "1px solid",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 4px",
  fontWeight: 700,
  fontSize: "13px",
};

const tileLabel: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "100%",
  lineHeight: 1.2,
};

const typeBadge: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 800,
  letterSpacing: "0.4px",
  opacity: 0.75,
  lineHeight: 1,
};

const emptyGrid: React.CSSProperties = {
  marginBottom: "20px",
  padding: "28px",
  background: "#151515",
  border: "1px solid #3A352E",
  borderRadius: "14px",
  color: "#C9C9C9",
  textAlign: "center",
};

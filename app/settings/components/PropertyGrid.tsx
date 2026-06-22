"use client";

import { BuildingArea } from "../lib/buildings-types";
import {
  getAreaTypeAbbrev,
  getTileLabel,
  getTileStyle,
  GOLD,
  sortPropertyGridAreas,
} from "../lib/buildings-areas";

type PropertyGridProps = {
  areas: BuildingArea[];
  onTileClick: (area: BuildingArea) => void;
};

export function StatusLegend() {
  const items = [
    { label: "Active", border: "#3d6b4f", bg: "rgba(28, 52, 40, 0.72)" },
    { label: "Out of Service", border: "#8B5252", bg: "rgba(28, 28, 28, 0.85)" },
    { label: "Inactive", border: "#5a5a5a", bg: "rgba(36, 36, 36, 0.75)" },
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
          <span
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "3px",
              border: `1px solid ${item.border}`,
              background: item.bg,
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default function PropertyGrid({ areas, onTileClick }: PropertyGridProps) {
  const sortedAreas = sortPropertyGridAreas(areas);

  if (sortedAreas.length === 0) {
    return (
      <div style={emptyGrid}>
        No locations yet. Use Bulk Manage to get started.
      </div>
    );
  }

  return (
    <div style={gridWrap}>
      {sortedAreas.map((area) => {
        const style = getTileStyle(area.area_type, area.status);
        const label = getTileLabel(area.name, area.area_type);
        const abbrev = getAreaTypeAbbrev(area.area_type);

        return (
          <button
            key={area.id}
            type="button"
            onClick={() => onTileClick(area)}
            title={`${area.name} — ${area.area_type} — ${area.status}`}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 0 12px rgba(200,169,106,0.22)`;
              e.currentTarget.style.borderColor = GOLD;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = style.border;
            }}
            style={{
              ...tile,
              background: style.background,
              borderColor: style.border,
              color: style.color,
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {style.showTypeLabel && abbrev && (
              <span style={typeBadge}>{abbrev}</span>
            )}
            <span style={tileLabel}>{label}</span>
          </button>
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
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 4px",
  fontWeight: 700,
  fontSize: "13px",
  transition:
    "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
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

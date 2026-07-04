"use client";

import { PmCycleEntry, PmTile } from "../lib/maintenance-types";
import { formatPmCycleStatusLabel } from "../lib/pm-cycle";
import { getPmTileStyle, PM_TILE_LEGEND } from "../lib/pm-tile-styles";
import { ONE_EYRIE, FOREST, FLAT_RED } from "@/app/lib/oneEyrieColors";
import { SETTINGS_CARD_TRANSITION } from "@/app/settings/lib/settings-ui-interactions";

type PmTileGridProps = {
  tiles: PmTile[];
  onOpenPm: (tile: PmTile) => void;
  emptyMessage?: string;
  totalCount?: number;
};

function cycleEntryColor(status: PmCycleEntry["status"]): string {
  switch (status) {
    case "completed":
      return FOREST.text;
    case "missed":
      return FLAT_RED.text;
    case "due":
      return ONE_EYRIE.gold;
    case "upcoming":
    default:
      return ONE_EYRIE.textSubtle;
  }
}

function PmCycleHistoryPanel({ tile }: { tile: PmTile }) {
  const { cycleHistory } = tile;

  if (cycleHistory.totalCount === 0 && cycleHistory.entries.length === 0) {
    return <span>No cycle history yet</span>;
  }

  return (
    <span style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontWeight: 700,
          marginBottom: cycleHistory.entries.length > 0 ? "4px" : 0,
        }}
      >
        {cycleHistory.summaryLabel}
      </span>
      {cycleHistory.entries.length > 0 && (
        <span
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 8px",
            lineHeight: 1.4,
          }}
        >
          {cycleHistory.entries.map((entry) => (
            <span
              key={`${entry.dueDate}-${entry.label}`}
              style={{
                color: cycleEntryColor(entry.status),
                fontWeight: entry.status === "due" ? 700 : 600,
              }}
            >
              {entry.label} {formatPmCycleStatusLabel(entry.status)}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

function areaLabel(tile: PmTile): string {
  if (tile.areaName && tile.assetLabel) {
    return `${tile.areaName} · ${tile.assetLabel}`;
  }
  return tile.areaName || tile.assetLabel || "Property-wide";
}

export default function PmTileGrid({
  tiles,
  onOpenPm,
  emptyMessage = "No PMs match the selected filters.",
  totalCount = 0,
}: PmTileGridProps) {
  return (
    <div
      style={{
        background: ONE_EYRIE.surfaceInset,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        {PM_TILE_LEGEND.map((item) => {
          const style = getPmTileStyle(item.urgency);
          return (
            <span
              key={item.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                color: ONE_EYRIE.textSubtle,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "4px",
                  background: style.background,
                  border: `1px solid ${style.border}`,
                }}
              />
              {item.label}
            </span>
          );
        })}
      </div>

      {totalCount === 0 ? (
        <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", padding: "20px 4px" }}>
          {emptyMessage}
        </div>
      ) : (
        <div
          className="maintenance-pm-tile-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          {tiles.map((tile) => {
            const style = getPmTileStyle(tile.urgency);
            return (
              <button
                key={tile.key}
                type="button"
                onClick={() => onOpenPm(tile)}
                style={{
                  textAlign: "left",
                  padding: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${style.border}`,
                  background: style.background,
                  color: style.color,
                  cursor: "pointer",
                  transition: SETTINGS_CARD_TRANSITION,
                  minHeight: "148px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "5px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "13px", lineHeight: 1.35 }}>
                  {tile.templateName}
                </div>
                <div style={{ fontSize: "11px", opacity: 0.92, lineHeight: 1.35 }}>
                  {areaLabel(tile)}
                </div>
                <div style={{ fontSize: "11px", fontWeight: 700 }}>
                  {tile.dueStatusLine}
                </div>
                <div style={{ fontSize: "10px", opacity: 0.88 }}>
                  {tile.frequencyLabel}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    opacity: 0.88,
                    marginTop: "auto",
                    lineHeight: 1.35,
                  }}
                >
                  <PmCycleHistoryPanel tile={tile} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

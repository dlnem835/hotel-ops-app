"use client";

import { PmTile } from "../lib/maintenance-types";
import { formatPmCompletionDate } from "../lib/pm-urgency";
import { getPmTileStyle, PM_TILE_LEGEND } from "../lib/pm-tile-styles";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { SETTINGS_CARD_TRANSITION } from "@/app/settings/lib/settings-ui-interactions";

type PmTileGridProps = {
  tiles: PmTile[];
  onOpenPm: (tile: PmTile) => void;
  emptyMessage?: string;
  totalCount?: number;
};

function PmCompletionHistory({ tile }: { tile: PmTile }) {
  if (!tile.lastCompletedAt) {
    return <span>Never completed</span>;
  }

  return (
    <span style={{ display: "block" }}>
      <span style={{ display: "block" }}>Last completed:</span>
      <span style={{ display: "block" }}>
        {formatPmCompletionDate(tile.lastCompletedAt)}
      </span>
      {tile.lastCompletedBy && (
        <span style={{ display: "block" }}>by {tile.lastCompletedBy}</span>
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
                  minHeight: "132px",
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
                    opacity: 0.82,
                    marginTop: "auto",
                    lineHeight: 1.35,
                  }}
                >
                  <PmCompletionHistory tile={tile} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PmTile } from "../lib/maintenance-types";
import {
  formatPmCycleProgressLabel,
  formatPmNextDueDate,
} from "../lib/pm-tile-display";
import { getPmTileStyle, PM_TILE_LEGEND } from "../lib/pm-tile-styles";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  SETTINGS_BUTTON_BASE,
  SETTINGS_CARD_TRANSITION,
} from "@/app/settings/lib/settings-ui-interactions";

type PmTileGridProps = {
  tiles: PmTile[];
  onOpenPm: (tile: PmTile) => void;
  emptyMessage?: string;
  totalCount?: number;
  search: string;
  onSearchChange: (value: string) => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
};

function areaLabel(tile: PmTile): string {
  if (tile.areaName && tile.assetLabel) {
    return `${tile.assetLabel} — ${tile.areaName}`;
  }
  return tile.areaName || tile.assetLabel || "Property-wide";
}

function PmTileDetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: "10px", lineHeight: 1.45 }}>
      <div style={{ opacity: 0.78, fontWeight: 600, marginBottom: "1px" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function PmTileProgressPanel({ tile }: { tile: PmTile }) {
  const { cycleHistory } = tile;
  const hasMultipleItems = (tile.locationCount || 1) > 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        marginTop: "auto",
      }}
    >
      <PmTileDetailLine
        label={
          hasMultipleItems ? "Items Completed" : "Completed"
        }
        value={
          hasMultipleItems
            ? `${tile.completedLocationCount || 0}/${tile.locationCount}`
            : formatPmCycleProgressLabel(
                cycleHistory.completedCount,
                cycleHistory.totalCount
              )
        }
      />
      <PmTileDetailLine label="Frequency" value={tile.frequencyLabel} />
      <PmTileDetailLine
        label="Next Due"
        value={formatPmNextDueDate(tile.nextDueDate)}
      />
    </div>
  );
}

function CarouselArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "Previous PM cards" : "Next PM cards"}
      style={{
        ...SETTINGS_BUTTON_BASE,
        flexShrink: 0,
        width: "30px",
        height: "30px",
        borderRadius: "8px",
        border: `1px solid ${ONE_EYRIE.border}`,
        background: ONE_EYRIE.surface,
        color: disabled ? ONE_EYRIE.textSubtle : ONE_EYRIE.gold,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <Icon size={16} />
    </button>
  );
}

export default function PmTileGrid({
  tiles,
  onOpenPm,
  emptyMessage = "No PMs match the selected filters.",
  totalCount = 0,
  search,
  onSearchChange,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
}: PmTileGridProps) {
  const showCarousel = Boolean(onPrev && onNext);

  return (
    <div
      className="maintenance-pm-tile-grid-panel"
      style={{
        background: ONE_EYRIE.surfaceInset,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "14px",
      }}
    >
      <div className="maintenance-pm-grid-search-wrap pass-on-search-wrap">
        <Search size={18} className="pass-on-search-wrap__icon" aria-hidden />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search PMs..."
          className="one-eyrie-field"
          aria-label="Search PMs"
        />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "12px",
          marginTop: "12px",
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

      <div className="maintenance-pm-tile-grid-carousel">
        {showCarousel ? (
          <div className="maintenance-pm-carousel-arrow">
            <CarouselArrow direction="prev" disabled={!canGoPrev} onClick={onPrev!} />
          </div>
        ) : null}

        <div className="maintenance-pm-tile-grid-carousel__body">
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
                    className="maintenance-pm-tile-card"
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
                      minHeight: "168px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.transform = "translateY(-1px)";
                      event.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.transform = "none";
                      event.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: "13px", lineHeight: 1.35 }}>
                      {tile.templateName}
                    </div>
                    <div style={{ fontSize: "11px", opacity: 0.92, lineHeight: 1.35 }}>
                      {areaLabel(tile)}
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: 700 }}>{tile.dueStatusLine}</div>
                    <PmTileProgressPanel tile={tile} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {showCarousel ? (
          <div className="maintenance-pm-carousel-arrow">
            <CarouselArrow direction="next" disabled={!canGoNext} onClick={onNext!} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

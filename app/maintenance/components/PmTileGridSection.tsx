"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PmTile } from "../lib/maintenance-types";
import {
  DEFAULT_PM_TILE_FILTERS,
  filterPmTilesBySearch,
  formatPmQueueShowingLabel,
  PM_QUEUE_PAGE_SIZE,
  PM_TILE_FILTER_OPTIONS,
  PmTileFilterKey,
  tileMatchesPmFilters,
} from "../lib/pm-tile-filters";
import PmTileGrid from "./PmTileGrid";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  goldHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";

function readInitialPmFiltersFromUrl(): PmTileFilterKey[] {
  if (typeof window === "undefined") return DEFAULT_PM_TILE_FILTERS;
  const filter = new URLSearchParams(window.location.search).get("filter");
  if (
    filter === "past_due" ||
    filter === "due_today" ||
    filter === "upcoming" ||
    filter === "completed"
  ) {
    return [filter];
  }
  return DEFAULT_PM_TILE_FILTERS;
}

type PmTileGridSectionProps = {
  tiles: PmTile[];
  onOpenPm: (tile: PmTile) => void;
  className?: string;
};

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
        alignSelf: "center",
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

export default function PmTileGridSection({ tiles, onOpenPm, className }: PmTileGridSectionProps) {
  const [activeFilters, setActiveFilters] = useState<Set<PmTileFilterKey>>(
    () => new Set(readInitialPmFiltersFromUrl())
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filteredTiles = useMemo(
    () =>
      filterPmTilesBySearch(
        tiles.filter((tile) => tileMatchesPmFilters(tile, activeFilters)),
        search
      ),
    [tiles, activeFilters, search]
  );

  const totalPages = Math.max(1, Math.ceil(filteredTiles.length / PM_QUEUE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * PM_QUEUE_PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PM_QUEUE_PAGE_SIZE, filteredTiles.length);
  const visibleTiles = filteredTiles.slice(pageStart, pageEnd);
  const remainingCount = Math.max(0, filteredTiles.length - pageEnd);

  const showingLabel = formatPmQueueShowingLabel(
    filteredTiles.length === 0 ? 0 : pageStart + 1,
    pageEnd,
    filteredTiles.length
  );

  useEffect(() => {
    setPage(0);
  }, [activeFilters, search]);

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  function toggleFilter(key: PmTileFilterKey) {
    setActiveFilters((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const canGoPrev = safePage > 0;
  const canGoNext = safePage < totalPages - 1;

  return (
    <>
      <div className="maintenance-dashboard-pm-controls">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
        <div
          style={{
            color: ONE_EYRIE.gold,
            fontWeight: 800,
            fontSize: "15px",
            marginRight: "4px",
            whiteSpace: "nowrap",
          }}
        >
          PM Tile Grid
        </div>

        {PM_TILE_FILTER_OPTIONS.map((option) => {
          const active = activeFilters.has(option.key);
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => toggleFilter(option.key)}
              style={{
                ...SETTINGS_BUTTON_BASE,
                background: active ? ONE_EYRIE.gold : "transparent",
                color: active ? ONE_EYRIE.surface : ONE_EYRIE.text,
                border: `1px solid ${active ? ONE_EYRIE.goldLight : ONE_EYRIE.border}`,
                borderRadius: "999px",
                padding: "8px 14px",
                fontWeight: 800,
                fontSize: "13px",
              }}
              {...goldHoverHandlers(active ? "primary" : "secondary")}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          color: ONE_EYRIE.textMuted,
          fontSize: "12px",
          fontWeight: 600,
          marginBottom: "10px",
        }}
      >
        {showingLabel}
      </div>
      </div>

      <div className={`maintenance-dashboard-pm-panel${className ? ` ${className}` : ""}`}>
        <div
          className="maintenance-pm-carousel"
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: "8px",
        }}
      >
        <div className="maintenance-pm-carousel-arrow">
          <CarouselArrow
            direction="prev"
            disabled={!canGoPrev}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <PmTileGrid
            tiles={visibleTiles}
            onOpenPm={onOpenPm}
            search={search}
            onSearchChange={setSearch}
            emptyMessage={
              search.trim()
                ? "No PM assignments match your search."
                : "No PMs match the selected filters."
            }
            totalCount={filteredTiles.length}
          />
        </div>

        <div className="maintenance-pm-carousel-arrow">
          <CarouselArrow
            direction="next"
            disabled={!canGoNext}
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
          />
        </div>
      </div>

      {canGoNext ? (
        <div className="maintenance-pm-show-more-wrap">
          <button
            type="button"
            className="maintenance-pm-show-more"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            style={{
              ...SETTINGS_BUTTON_BASE,
              marginTop: "12px",
              width: "100%",
              borderRadius: "10px",
              border: `1px solid ${ONE_EYRIE.border}`,
              background: ONE_EYRIE.surface,
              color: ONE_EYRIE.gold,
              padding: "10px 14px",
              fontWeight: 800,
              fontSize: "13px",
              cursor: "pointer",
            }}
            {...goldHoverHandlers("secondary")}
          >
            Show More ({remainingCount} remaining)
          </button>
        </div>
      ) : null}

      {canGoPrev ? (
        <div className="maintenance-pm-show-previous-wrap">
          <button
            type="button"
            className="maintenance-pm-show-previous"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            style={{
              ...SETTINGS_BUTTON_BASE,
              marginTop: "8px",
              width: "100%",
              borderRadius: "10px",
              border: `1px solid ${ONE_EYRIE.border}`,
              background: "transparent",
              color: ONE_EYRIE.textMuted,
              padding: "8px 14px",
              fontWeight: 700,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Show Previous
          </button>
        </div>
      ) : null}
      </div>
    </>
  );
}

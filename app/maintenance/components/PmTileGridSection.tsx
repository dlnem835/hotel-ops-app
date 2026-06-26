"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
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

export default function PmTileGridSection({ tiles, onOpenPm }: PmTileGridSectionProps) {
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
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "6px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            flex: 1,
            minWidth: 0,
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

        <div style={{ position: "relative", minWidth: "180px", flex: "0 1 220px" }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: ONE_EYRIE.textSubtle,
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PMs..."
            style={{
              width: "100%",
              height: "36px",
              paddingLeft: "32px",
              paddingRight: "10px",
              background: ONE_EYRIE.black,
              color: ONE_EYRIE.text,
              border: `1px solid ${ONE_EYRIE.borderInput}`,
              borderRadius: "8px",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>
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
            onClick={() =>
              setPage((current) => Math.min(totalPages - 1, current + 1))
            }
          />
        </div>
      </div>
    </div>
  );
}

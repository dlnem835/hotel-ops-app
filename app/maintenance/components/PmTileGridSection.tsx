"use client";

import { useMemo, useState } from "react";
import { PmTile } from "../lib/maintenance-types";
import {
  DEFAULT_PM_TILE_FILTERS,
  DEFAULT_PM_UPCOMING_HORIZON,
  filterPmTilesBySearch,
  formatPmQueueShowingLabel,
  getPmTileEmptyMessage,
  PM_QUEUE_PAGE_SIZE,
  PM_TILE_FILTER_OPTIONS,
  PM_UPCOMING_HORIZON_OPTIONS,
  PmTileFilterKey,
  PmUpcomingHorizonKey,
  sortPmTilesForFilters,
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

export default function PmTileGridSection({ tiles, onOpenPm, className }: PmTileGridSectionProps) {
  const [activeFilters, setActiveFilters] = useState<Set<PmTileFilterKey>>(
    () => new Set(readInitialPmFiltersFromUrl())
  );
  const [upcomingHorizon, setUpcomingHorizon] = useState<PmUpcomingHorizonKey>(
    DEFAULT_PM_UPCOMING_HORIZON
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const showUpcomingHorizon = activeFilters.has("upcoming");

  const filteredTiles = useMemo(
    () =>
      sortPmTilesForFilters(
        filterPmTilesBySearch(
          tiles.filter((tile) =>
            tileMatchesPmFilters(tile, activeFilters, upcomingHorizon)
          ),
          search
        ),
        activeFilters
      ),
    [tiles, activeFilters, upcomingHorizon, search]
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

  function toggleFilter(key: PmTileFilterKey) {
    setPage(0);
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

  function handleUpcomingHorizonChange(key: PmUpcomingHorizonKey) {
    setPage(0);
    setUpcomingHorizon(key);
  }

  function handleSearchChange(value: string) {
    setPage(0);
    setSearch(value);
  }

  const canGoPrev = safePage > 0;
  const canGoNext = safePage < totalPages - 1;

  return (
    <>
      <div className="maintenance-dashboard-pm-controls">
        <div
          style={{
            color: ONE_EYRIE.gold,
            fontWeight: 800,
            fontSize: "15px",
            marginBottom: "10px",
          }}
        >
          PM Tile Grid
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            marginBottom: showUpcomingHorizon ? "8px" : "10px",
          }}
        >
          {PM_TILE_FILTER_OPTIONS.map((option) => {
            const active = activeFilters.has(option.key);
            return (
              <button
                key={option.key}
                type="button"
                data-active={active ? "true" : undefined}
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

        {showUpcomingHorizon ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              alignItems: "center",
              marginBottom: "10px",
            }}
            role="group"
            aria-label="Upcoming horizon"
          >
            {PM_UPCOMING_HORIZON_OPTIONS.map((option) => {
              const active = upcomingHorizon === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  data-active={active ? "true" : undefined}
                  onClick={() => handleUpcomingHorizonChange(option.key)}
                  style={{
                    ...SETTINGS_BUTTON_BASE,
                    background: active ? ONE_EYRIE.goldGlow : "transparent",
                    color: active ? ONE_EYRIE.goldLight : ONE_EYRIE.textMuted,
                    border: `1px solid ${active ? ONE_EYRIE.gold : ONE_EYRIE.border}`,
                    borderRadius: "999px",
                    padding: "6px 12px",
                    fontWeight: 700,
                    fontSize: "12px",
                  }}
                  {...goldHoverHandlers("secondary")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}

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
        <PmTileGrid
          tiles={visibleTiles}
          onOpenPm={onOpenPm}
          search={search}
          onSearchChange={handleSearchChange}
          emptyMessage={getPmTileEmptyMessage({
            search,
            activeFilters,
            upcomingHorizon,
          })}
          totalCount={filteredTiles.length}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={() => setPage((current) => Math.max(0, current - 1))}
          onNext={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
        />

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

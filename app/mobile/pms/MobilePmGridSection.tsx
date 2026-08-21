"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { PmTile } from "@/app/maintenance/lib/maintenance-types";
import { formatPmCompletionDate } from "@/app/maintenance/lib/pm-urgency";
import {
  DEFAULT_PM_TILE_FILTERS,
  DEFAULT_PM_UPCOMING_HORIZON,
  filterPmTilesBySearch,
  formatPmQueueShowingLabel,
  getPmTileEmptyMessage,
  PM_TILE_FILTER_OPTIONS,
  PM_UPCOMING_HORIZON_OPTIONS,
  PmTileFilterKey,
  PmUpcomingHorizonKey,
  sortPmTilesForFilters,
  tileMatchesPmFilters,
} from "@/app/maintenance/lib/pm-tile-filters";
import { getPmTileStyle, PM_TILE_LEGEND } from "@/app/maintenance/lib/pm-tile-styles";
import { fetchPmTiles, pmAreaLabel } from "./lib/pm-shared";

function PmCompletionHistory({ tile }: { tile: PmTile }) {
  if (!tile.lastCompletedAt) {
    return <span>Never completed</span>;
  }

  return (
    <span className="one-eyrie-mobile-pm-queue-row__history">
      <span>Last completed:</span>
      <span>{formatPmCompletionDate(tile.lastCompletedAt)}</span>
      {tile.lastCompletedBy ? (
        <span>by {tile.lastCompletedByLabel || tile.lastCompletedBy}</span>
      ) : null}
    </span>
  );
}

export default function MobilePmGridSection() {
  const router = useRouter();
  const [tiles, setTiles] = useState<PmTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<PmTileFilterKey>>(
    () => new Set(DEFAULT_PM_TILE_FILTERS)
  );
  const [upcomingHorizon, setUpcomingHorizon] = useState<PmUpcomingHorizonKey>(
    DEFAULT_PM_UPCOMING_HORIZON
  );
  const [search, setSearch] = useState("");
  const showUpcomingHorizon = activeFilters.has("upcoming");

  useEffect(() => {
    let mounted = true;

    void fetchPmTiles()
      .then((data) => {
        if (!mounted) return;
        setTiles(data);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load PMs");
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

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

  const showingLabel = formatPmQueueShowingLabel(
    filteredTiles.length === 0 ? 0 : 1,
    filteredTiles.length,
    filteredTiles.length
  );

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

  function handleOpenPm(tile: PmTile) {
    router.push(`/maintenance/pm-program/${tile.templateId}?from=mobile`);
  }

  if (loading) {
    return <div className="one-eyrie-mobile-status">Loading PM grid…</div>;
  }

  return (
    <div className="one-eyrie-mobile-pm-grid-section">
      <div className="one-eyrie-mobile-pm-grid-section__header">
        <div className="one-eyrie-mobile-pm-grid-section__title">PM Tile Grid</div>
        <div className="one-eyrie-mobile-pm-grid-section__filters">
          {PM_TILE_FILTER_OPTIONS.map((option) => {
            const active = activeFilters.has(option.key);
            return (
              <button
                key={option.key}
                type="button"
                className={`one-eyrie-mobile-pm-filter${active ? " one-eyrie-mobile-pm-filter--active" : ""}`}
                onClick={() => toggleFilter(option.key)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {showUpcomingHorizon ? (
          <div
            className="one-eyrie-mobile-pm-grid-section__horizons"
            role="group"
            aria-label="Upcoming horizon"
          >
            {PM_UPCOMING_HORIZON_OPTIONS.map((option) => {
              const active = upcomingHorizon === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`one-eyrie-mobile-pm-horizon${active ? " one-eyrie-mobile-pm-horizon--active" : ""}`}
                  onClick={() => setUpcomingHorizon(option.key)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="one-eyrie-mobile-search-wrap one-eyrie-mobile-pm-search-wrap pass-on-search-wrap">
        <Search size={18} className="pass-on-search-wrap__icon" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search PMs..."
          className="one-eyrie-mobile-search"
          aria-label="Search PMs"
        />
      </div>

      <div className="one-eyrie-mobile-pm-grid-section__count">{showingLabel}</div>

      <div className="one-eyrie-mobile-pm-legend">
        {PM_TILE_LEGEND.map((item) => {
          const style = getPmTileStyle(item.urgency);
          return (
            <span key={item.label} className="one-eyrie-mobile-pm-legend__item">
              <span
                className="one-eyrie-mobile-pm-legend__swatch"
                style={{
                  background: style.background,
                  borderColor: style.border,
                }}
              />
              {item.label}
            </span>
          );
        })}
      </div>

      {error ? <div className="one-eyrie-mobile-error">{error}</div> : null}

      <div className="one-eyrie-mobile-pm-grid-panel">
        {filteredTiles.length === 0 ? (
          <div className="one-eyrie-mobile-status">
            {getPmTileEmptyMessage({
              search,
              activeFilters,
              upcomingHorizon,
            })}
          </div>
        ) : (
          <div className="one-eyrie-mobile-pm-grid">
            {filteredTiles.map((tile) => {
              const style = getPmTileStyle(tile.urgency);
              return (
                <button
                  key={tile.key}
                  type="button"
                  className="one-eyrie-mobile-pm-queue-row"
                  style={{
                    borderLeftColor: style.border,
                  }}
                  onClick={() => handleOpenPm(tile)}
                >
                  <div className="one-eyrie-mobile-pm-queue-row__main">
                    <div className="one-eyrie-mobile-pm-queue-row__top">
                      <div className="one-eyrie-mobile-pm-queue-row__name">
                        {tile.templateName}
                      </div>
                      <span
                        className="one-eyrie-mobile-pm-queue-row__urgency"
                        style={{
                          background: style.background,
                          borderColor: style.border,
                          color: style.color,
                        }}
                      >
                        {tile.dueLabel}
                      </span>
                    </div>
                    <div className="one-eyrie-mobile-pm-queue-row__area">{pmAreaLabel(tile)}</div>
                    <div
                      className="one-eyrie-mobile-pm-queue-row__status"
                      style={{ color: style.color }}
                    >
                      {tile.dueStatusLine}
                    </div>
                    <div className="one-eyrie-mobile-pm-queue-row__frequency">
                      {tile.frequencyLabel}
                    </div>
                    <PmCompletionHistory tile={tile} />
                  </div>
                  <ChevronRight
                    size={18}
                    aria-hidden
                    className="one-eyrie-mobile-pm-queue-row__chevron"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

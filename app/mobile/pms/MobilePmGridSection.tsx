"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { PmTile } from "@/app/maintenance/lib/maintenance-types";
import { formatPmCompletionDate } from "@/app/maintenance/lib/pm-urgency";
import {
  DEFAULT_PM_TILE_FILTERS,
  filterPmTilesBySearch,
  formatPmQueueShowingLabel,
  PM_TILE_FILTER_OPTIONS,
  PmTileFilterKey,
  tileMatchesPmFilters,
} from "@/app/maintenance/lib/pm-tile-filters";
import { getPmTileStyle, PM_TILE_LEGEND } from "@/app/maintenance/lib/pm-tile-styles";
import { pmSessionUrl } from "@/app/maintenance/lib/pm-session-return";
import { fetchPmTiles, pmAreaLabel, startPmAssignment } from "./lib/pm-shared";

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
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<PmTileFilterKey>>(
    () => new Set(DEFAULT_PM_TILE_FILTERS)
  );
  const [search, setSearch] = useState("");

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
      filterPmTilesBySearch(
        tiles.filter((tile) => tileMatchesPmFilters(tile, activeFilters)),
        search
      ),
    [tiles, activeFilters, search]
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

  async function handleOpenPm(tile: PmTile) {
    if (startingKey) return;
    setStartingKey(tile.key);
    setError(null);

    try {
      const occurrenceId = await startPmAssignment(tile.assignmentId);
      router.push(pmSessionUrl(occurrenceId, true));
    } catch (startError) {
      setStartingKey(null);
      setError(startError instanceof Error ? startError.message : "Unable to start PM");
    }
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
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search PMs..."
        className="one-eyrie-mobile-pm-search"
        aria-label="Search PMs"
      />

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
            {search.trim()
              ? "No PM assignments match your search."
              : "No PMs match the selected filters."}
          </div>
        ) : (
          <div className="one-eyrie-mobile-pm-grid">
            {filteredTiles.map((tile) => {
              const style = getPmTileStyle(tile.urgency);
              const isStarting = startingKey === tile.key;

              return (
                <button
                  key={tile.key}
                  type="button"
                  className="one-eyrie-mobile-pm-queue-row"
                  disabled={Boolean(startingKey)}
                  style={{
                    borderLeftColor: style.border,
                    opacity: startingKey && !isStarting ? 0.55 : 1,
                  }}
                  onClick={() => void handleOpenPm(tile)}
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
                    {isStarting ? (
                      <div className="one-eyrie-mobile-pm-queue-row__opening">Opening…</div>
                    ) : null}
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

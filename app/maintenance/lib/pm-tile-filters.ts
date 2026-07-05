import { PmTile, PmTileUrgency } from "./maintenance-types";

export type PmTileFilterKey = "past_due" | "due_today" | "upcoming" | "completed";

export const PM_TILE_FILTER_OPTIONS: { key: PmTileFilterKey; label: string }[] = [
  { key: "past_due", label: "Past Due" },
  { key: "due_today", label: "Due Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

export const DEFAULT_PM_TILE_FILTERS: PmTileFilterKey[] = [
  "past_due",
  "due_today",
  "upcoming",
];

export function urgencyMatchesPmFilter(
  urgency: PmTileUrgency,
  filter: PmTileFilterKey
): boolean {
  switch (filter) {
    case "past_due":
      return urgency === "past_due";
    case "due_today":
      return urgency === "due_today";
    case "upcoming":
      return urgency === "due_tomorrow" || urgency === "upcoming";
    case "completed":
      return urgency === "completed";
    default:
      return false;
  }
}

export function tileMatchesPmFilters(
  tile: PmTile,
  activeFilters: Set<PmTileFilterKey>
): boolean {
  if (activeFilters.size === 0) return false;
  for (const filter of activeFilters) {
    if (urgencyMatchesPmFilter(tile.urgency, filter)) return true;
  }
  return false;
}

export function formatPmQueueShowingLabel(
  start: number,
  end: number,
  total: number
): string {
  if (total === 0) {
    return "Showing 0 of 0 PMs";
  }

  const noun = total === 1 ? "PM" : "PMs";
  return `Showing ${start}–${end} of ${total} ${noun}`;
}

export function filterPmTilesBySearch(tiles: PmTile[], search: string): PmTile[] {
  if (!search.trim()) return tiles;
  const term = search.trim().toLowerCase();
  return tiles.filter(
    (tile) =>
      tile.templateName.toLowerCase().includes(term) ||
      (tile.areaName || "").toLowerCase().includes(term) ||
      (tile.assetLabel || "").toLowerCase().includes(term) ||
      tile.frequencyLabel.toLowerCase().includes(term)
  );
}

export const PM_QUEUE_PAGE_SIZE = 12;

import { PmTile, PmTileUrgency } from "./maintenance-types";
import { parseDate, PM_URGENCY_ORDER, startOfDay } from "./pm-urgency";

export type PmTileFilterKey = "past_due" | "due_today" | "upcoming" | "completed";

export type PmUpcomingHorizonKey =
  | "30_days"
  | "60_days"
  | "90_days"
  | "6_months"
  | "12_months";

export const PM_TILE_FILTER_OPTIONS: { key: PmTileFilterKey; label: string }[] = [
  { key: "past_due", label: "Past Due" },
  { key: "due_today", label: "Due Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

export const PM_UPCOMING_HORIZON_OPTIONS: {
  key: PmUpcomingHorizonKey;
  label: string;
  emptyPhrase: string;
}[] = [
  { key: "30_days", label: "30 Days", emptyPhrase: "30 days" },
  { key: "60_days", label: "60 Days", emptyPhrase: "60 days" },
  { key: "90_days", label: "90 Days", emptyPhrase: "90 days" },
  { key: "6_months", label: "6 Months", emptyPhrase: "6 months" },
  { key: "12_months", label: "12 Months", emptyPhrase: "12 months" },
];

export const DEFAULT_PM_TILE_FILTERS: PmTileFilterKey[] = [
  "past_due",
  "due_today",
  "upcoming",
];

export const DEFAULT_PM_UPCOMING_HORIZON: PmUpcomingHorizonKey = "90_days";

export function getUpcomingHorizonEndDate(
  horizon: PmUpcomingHorizonKey,
  now = new Date()
): Date {
  const end = startOfDay(now);

  switch (horizon) {
    case "30_days":
      end.setDate(end.getDate() + 30);
      return end;
    case "60_days":
      end.setDate(end.getDate() + 60);
      return end;
    case "90_days":
      end.setDate(end.getDate() + 90);
      return end;
    case "6_months":
      end.setMonth(end.getMonth() + 6);
      return end;
    case "12_months":
      end.setMonth(end.getMonth() + 12);
      return end;
    default:
      end.setDate(end.getDate() + 90);
      return end;
  }
}

export function formatPmUpcomingHorizonEmptyPhrase(
  horizon: PmUpcomingHorizonKey
): string {
  return (
    PM_UPCOMING_HORIZON_OPTIONS.find((option) => option.key === horizon)
      ?.emptyPhrase ?? "90 days"
  );
}

export function formatPmUpcomingEmptyMessage(horizon: PmUpcomingHorizonKey): string {
  return `No PMs due in the next ${formatPmUpcomingHorizonEmptyPhrase(horizon)}.`;
}

/** Future (after today) through the selected horizon end, inclusive. */
export function tileIsWithinUpcomingHorizon(
  tile: PmTile,
  horizon: PmUpcomingHorizonKey,
  now = new Date()
): boolean {
  if (!tile.nextDueDate) return false;
  if (tile.urgency === "completed") return false;

  const today = startOfDay(now);
  const due = startOfDay(parseDate(tile.nextDueDate));
  const horizonEnd = getUpcomingHorizonEndDate(horizon, now);

  return due.getTime() > today.getTime() && due.getTime() <= horizonEnd.getTime();
}

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
      // Prefer tileMatchesPmFilters / tileIsWithinUpcomingHorizon for Upcoming —
      // urgency alone only covers the short styling window (tomorrow / ≤7 days).
      return urgency === "due_tomorrow" || urgency === "upcoming";
    case "completed":
      return urgency === "completed";
    default:
      return false;
  }
}

export function tileMatchesPmFilter(
  tile: PmTile,
  filter: PmTileFilterKey,
  upcomingHorizon: PmUpcomingHorizonKey = DEFAULT_PM_UPCOMING_HORIZON,
  now = new Date()
): boolean {
  switch (filter) {
    case "past_due":
      return tile.urgency === "past_due";
    case "due_today":
      return tile.urgency === "due_today";
    case "upcoming":
      return tileIsWithinUpcomingHorizon(tile, upcomingHorizon, now);
    case "completed":
      return tile.urgency === "completed";
    default:
      return false;
  }
}

export function tileMatchesPmFilters(
  tile: PmTile,
  activeFilters: Set<PmTileFilterKey>,
  upcomingHorizon: PmUpcomingHorizonKey = DEFAULT_PM_UPCOMING_HORIZON,
  now = new Date()
): boolean {
  if (activeFilters.size === 0) return false;
  for (const filter of activeFilters) {
    if (tileMatchesPmFilter(tile, filter, upcomingHorizon, now)) return true;
  }
  return false;
}

export function sortPmTilesForFilters(
  tiles: PmTile[],
  activeFilters: Set<PmTileFilterKey>
): PmTile[] {
  const upcomingOnly =
    activeFilters.size === 1 && activeFilters.has("upcoming");

  return [...tiles].sort((a, b) => {
    if (upcomingOnly) {
      const dateDiff = (a.nextDueDate || "").localeCompare(b.nextDueDate || "");
      if (dateDiff !== 0) return dateDiff;
      return a.templateName.localeCompare(b.templateName);
    }

    const urgencyDiff = PM_URGENCY_ORDER[a.urgency] - PM_URGENCY_ORDER[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    const dateDiff = (a.nextDueDate || "").localeCompare(b.nextDueDate || "");
    if (dateDiff !== 0) return dateDiff;
    return a.templateName.localeCompare(b.templateName);
  });
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
      (tile.locations || []).some(
        (location) =>
          (location.areaName || "").toLowerCase().includes(term) ||
          (location.assetLabel || "").toLowerCase().includes(term)
      ) ||
      tile.frequencyLabel.toLowerCase().includes(term)
  );
}

export function getPmTileEmptyMessage(options: {
  search: string;
  activeFilters: Set<PmTileFilterKey>;
  upcomingHorizon: PmUpcomingHorizonKey;
}): string {
  if (options.search.trim()) {
    return "No PM assignments match your search.";
  }

  if (
    options.activeFilters.size === 1 &&
    options.activeFilters.has("upcoming")
  ) {
    return formatPmUpcomingEmptyMessage(options.upcomingHorizon);
  }

  return "No PMs match the selected filters.";
}

export const PM_QUEUE_PAGE_SIZE = 12;

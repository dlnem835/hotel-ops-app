import { AMBER, FLAT_RED, FOREST, NEUTRAL_PILL, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { PmTileUrgency } from "./maintenance-types";

const MUTED_BLUE = {
  bg: "#1A1F28",
  border: "#4A5A6B",
  text: "#A8B8C9",
};

export function getPmTileStyle(urgency: PmTileUrgency) {
  switch (urgency) {
    case "past_due":
      return {
        background: FLAT_RED.bg,
        border: FLAT_RED.border,
        color: FLAT_RED.text,
      };
    case "due_today":
      return {
        background: AMBER.bg,
        border: ONE_EYRIE.gold,
        color: ONE_EYRIE.gold,
      };
    case "due_tomorrow":
    case "upcoming":
      return {
        background: MUTED_BLUE.bg,
        border: MUTED_BLUE.border,
        color: MUTED_BLUE.text,
      };
    case "completed":
    case "current":
    default:
      return {
        background: FOREST.bg,
        border: FOREST.border,
        color: FOREST.text,
      };
  }
}

export const PM_TILE_LEGEND = [
  { label: "Past due", urgency: "past_due" as const },
  { label: "Due today", urgency: "due_today" as const },
  { label: "Tomorrow / upcoming", urgency: "upcoming" as const },
  { label: "Completed / current", urgency: "current" as const },
];

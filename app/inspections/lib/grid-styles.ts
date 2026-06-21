import { AMBER, FLAT_RED, FOREST, NEUTRAL_PILL, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { GridState } from "./inspection-types";

export function getGridTileStyle(state: GridState) {
  switch (state) {
    case "strong":
      return {
        background: FOREST.bg,
        border: FOREST.border,
        color: FOREST.text,
      };
    case "watch":
      return {
        background: AMBER.bg,
        border: AMBER.border,
        color: AMBER.text,
      };
    case "low":
      return {
        background: FLAT_RED.bg,
        border: FLAT_RED.border,
        color: FLAT_RED.text,
      };
    case "oos":
      return {
        background: ONE_EYRIE.black,
        border: "#2A2A2A",
        color: NEUTRAL_PILL.text,
      };
    case "not_inspected":
    default:
      return {
        background: "#242424",
        border: NEUTRAL_PILL.border,
        color: NEUTRAL_PILL.text,
      };
  }
}

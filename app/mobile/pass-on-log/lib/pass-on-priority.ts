import type { CSSProperties } from "react";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

export function priorityClassName(priority: string): string {
  if (priority === "Urgent") return "one-eyrie-mobile-priority one-eyrie-mobile-priority--urgent";
  if (priority === "Important") return "one-eyrie-mobile-priority one-eyrie-mobile-priority--important";
  return "one-eyrie-mobile-priority one-eyrie-mobile-priority--normal";
}

export function priorityInlineStyle(priority: string): CSSProperties {
  const color =
    priority === "Urgent"
      ? FLAT_RED.border
      : priority === "Important"
        ? ONE_EYRIE.gold
        : FOREST.border;

  const textColor =
    priority === "Urgent"
      ? FLAT_RED.text
      : priority === "Important"
        ? ONE_EYRIE.gold
        : FOREST.text;

  return {
    display: "inline-block",
    color: textColor,
    border: `1px solid ${color}`,
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  };
}

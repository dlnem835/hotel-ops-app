import type { CSSProperties } from "react";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { WorkOrderPriority } from "@/app/maintenance/lib/maintenance-types";

export const WORK_ORDER_PRIORITY_ORDER: Record<WorkOrderPriority, number> = {
  Urgent: 0,
  Important: 1,
  Normal: 2,
};

export function getWorkOrderPriorityPillStyle(priority: string): CSSProperties {
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

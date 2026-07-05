import { AMBER, FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { calculatePmHealthPercent } from "./pm-cycle";

export type PmHealthStatus = "healthy" | "needs_attention" | "critical";

export type PmHealthCounts = {
  completedOnTime: number;
  completedLate: number;
  pastDueCount: number;
  missedCount: number;
};

export type PmHealthStatusPresentation = {
  status: PmHealthStatus;
  label: string;
  emoji: string;
  accent: string;
  border: string;
  background: string;
};

const STATUS_PRESENTATION: Record<PmHealthStatus, Omit<PmHealthStatusPresentation, "status">> = {
  healthy: {
    label: "Healthy",
    emoji: "🟢",
    accent: FOREST.text,
    border: FOREST.border,
    background: FOREST.bg,
  },
  needs_attention: {
    label: "Needs Attention",
    emoji: "🟡",
    accent: ONE_EYRIE.gold,
    border: AMBER.border,
    background: AMBER.bg,
  },
  critical: {
    label: "Critical",
    emoji: "🔴",
    accent: FLAT_RED.text,
    border: FLAT_RED.border,
    background: FLAT_RED.bg,
  },
};

export function resolvePmHealthStatus(counts: PmHealthCounts): PmHealthStatus {
  const { completedOnTime, completedLate, pastDueCount, missedCount } = counts;

  if (missedCount > 0 || pastDueCount >= 3) {
    return "critical";
  }

  const healthPercent = calculatePmHealthPercent({
    completed: completedOnTime + completedLate,
    missed: missedCount,
    pastDueOpen: pastDueCount,
  });

  if (pastDueCount > 0 || completedLate > 0 || healthPercent < 70) {
    return "critical";
  }

  if (healthPercent < 90) {
    return "needs_attention";
  }

  return "healthy";
}

export function getPmHealthStatusPresentation(
  status: PmHealthStatus
): PmHealthStatusPresentation {
  return {
    status,
    ...STATUS_PRESENTATION[status],
  };
}

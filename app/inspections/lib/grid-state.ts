import { GridState } from "./inspection-types";
import { formatInspectionScorePercent } from "./scoring";

export function getGridState(input: {
  roomStatus: string;
  inspectedInPeriod: boolean;
  scorePercent: number | null;
  lowThreshold?: number;
  strongThreshold?: number;
}): GridState {
  const low = input.lowThreshold ?? 80;
  const strong = input.strongThreshold ?? 90;

  if (input.roomStatus === "Out of Service") {
    return "oos";
  }

  if (!input.inspectedInPeriod || input.scorePercent === null) {
    return "not_inspected";
  }

  if (input.scorePercent >= strong) {
    return "strong";
  }

  if (input.scorePercent >= low) {
    return "watch";
  }

  return "low";
}

export function formatScoreLabel(scorePercent: number | null): string {
  return formatInspectionScorePercent(scorePercent);
}

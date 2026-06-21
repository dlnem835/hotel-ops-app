import {
  InspectionItemOutcome,
  InspectionScore,
  PropertyTemplateContent,
} from "../standards/types";

export type { InspectionItemOutcome, InspectionScore };

export type ScoredItemInput = {
  itemKey: string;
  pointValue: number;
  outcome: InspectionItemOutcome;
};

export function deriveScorePercent(
  earnedPoints: number | null | undefined,
  possiblePoints: number | null | undefined,
  storedPercent?: number | null
): number | null {
  const earned = Number(earnedPoints) || 0;
  const possible = Number(possiblePoints) || 0;
  if (possible > 0) {
    return Math.round((earned / possible) * 10000) / 100;
  }
  if (storedPercent !== null && storedPercent !== undefined) {
    const stored = Number(storedPercent);
    return Number.isFinite(stored) ? stored : null;
  }
  return null;
}

export function calculateInspectionScore(
  items: ScoredItemInput[]
): InspectionScore {
  let earnedPoints = 0;
  let possiblePoints = 0;

  for (const item of items) {
    if (item.outcome === "na") continue;

    const weight = Math.max(0, Number(item.pointValue) || 0);
    possiblePoints += weight;

    if (item.outcome === "pass") {
      earnedPoints += weight;
    }
  }

  const scorePercent = deriveScorePercent(earnedPoints, possiblePoints);

  return { earnedPoints, possiblePoints, scorePercent };
}

/** Score a completed inspection using template item keys mapped to outcomes. */
export function scoreInspectionFromContent(
  content: PropertyTemplateContent,
  results: Record<string, InspectionItemOutcome | undefined>
): InspectionScore {
  const items: ScoredItemInput[] = [];

  for (const category of content.categories) {
    for (const item of category.items) {
      const outcome = results[item.key];
      if (!outcome) continue;

      items.push({
        itemKey: item.key,
        pointValue: item.pointValue,
        outcome,
      });
    }
  }

  return calculateInspectionScore(items);
}

export function formatInspectionScorePercent(scorePercent: number | null): string {
  if (scorePercent === null) return "—";
  const rounded = Math.round(scorePercent * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function formatInspectionScorePoints(
  earnedPoints: number,
  possiblePoints: number
): string {
  return `${earnedPoints} / ${possiblePoints}`;
}

export function formatInspectionScoreDisplay(score: InspectionScore): {
  percentLabel: string;
  pointsLabel: string;
} {
  return {
    percentLabel: formatInspectionScorePercent(score.scorePercent),
    pointsLabel: formatInspectionScorePoints(
      score.earnedPoints,
      score.possiblePoints
    ),
  };
}

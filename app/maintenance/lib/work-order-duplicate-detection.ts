import "server-only";

import OpenAI from "openai";
import type { WorkOrder } from "@/app/maintenance/lib/maintenance-types";
import type { DuplicateWorkOrderCandidate } from "@/app/maintenance/lib/work-order-duplicate-types";

export type { DuplicateWorkOrderCandidate } from "@/app/maintenance/lib/work-order-duplicate-types";

const MODEL = "gpt-4o-mini";
const MAX_AI_CANDIDATES = 8;

function getOpenAiClient(): OpenAI | null {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function normalizeText(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function locationKey(areaId: number | null, areaLabel: string | null): string {
  if (typeof areaId === "number" && Number.isFinite(areaId)) {
    return `id:${areaId}`;
  }
  return `label:${normalizeText(areaLabel)}`;
}

function sameLocation(
  a: { areaId: number | null; areaLabel: string | null },
  b: { areaId: number | null; areaLabel: string | null }
): boolean {
  const aKey = locationKey(a.areaId, a.areaLabel);
  const bKey = locationKey(b.areaId, b.areaLabel);
  if (!aKey || aKey === "label:" || !bKey || bKey === "label:") return false;
  return aKey === bKey;
}

function tokenOverlapScore(a: string, b: string): number {
  const aTokens = new Set(normalizeText(a).split(" ").filter((t) => t.length > 2));
  const bTokens = new Set(normalizeText(b).split(" ").filter((t) => t.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function daysSince(iso: string, now = Date.now()): number {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 999;
  return (now - ts) / (1000 * 60 * 60 * 24);
}

type Draft = {
  areaId: number | null;
  areaLabel: string | null;
  item: string | null;
  description: string;
  subject: string;
};

type Scored = {
  workOrder: WorkOrder;
  score: number;
  matchReason: string;
};

function scoreStructuredMatch(draft: Draft, existing: WorkOrder): Scored | null {
  if (
    !sameLocation(
      { areaId: draft.areaId, areaLabel: draft.areaLabel },
      { areaId: existing.areaId, areaLabel: existing.areaLabel }
    )
  ) {
    return null;
  }

  let score = 40;
  const reasons: string[] = ["Same location"];

  const draftItem = normalizeText(draft.item);
  const existingItem = normalizeText(existing.item);
  if (draftItem && existingItem && draftItem === existingItem) {
    score += 35;
    reasons.push("Same item/issue");
  } else if (draftItem && existingItem) {
    const itemOverlap = tokenOverlapScore(draftItem, existingItem);
    if (itemOverlap >= 0.5) {
      score += 18;
      reasons.push("Similar item/issue");
    }
  }

  const draftText = `${draft.subject} ${draft.description}`;
  const existingText = `${existing.subject} ${existing.description || ""}`;
  const textOverlap = tokenOverlapScore(draftText, existingText);
  if (textOverlap >= 0.45) {
    score += 20;
    reasons.push("Similar description");
  } else if (textOverlap >= 0.25) {
    score += 10;
    reasons.push("Partially similar description");
  }

  const ageDays = daysSince(existing.createdAt);
  if (ageDays <= 3) {
    score += 10;
    reasons.push("Created recently");
  } else if (ageDays <= 14) {
    score += 5;
  }

  if (score < 55) return null;
  return { workOrder: existing, score, matchReason: reasons.join(" · ") };
}

async function semanticMatchIds(
  draft: Draft,
  candidates: WorkOrder[]
): Promise<Set<number>> {
  const client = getOpenAiClient();
  if (!client || candidates.length === 0) return new Set();

  const payload = candidates.slice(0, MAX_AI_CANDIDATES).map((wo) => ({
    id: wo.id,
    item: wo.item,
    subject: wo.subject,
    description: wo.description,
  }));

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You compare hotel maintenance work orders at the SAME location only. Return JSON {\"duplicateIds\": number[]} for candidates that describe substantially the same issue as the draft, even with different wording. Do not match unrelated issues. Be conservative.",
        },
        {
          role: "user",
          content: JSON.stringify({
            draft: {
              item: draft.item,
              subject: draft.subject,
              description: draft.description,
            },
            candidates: payload,
          }),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw) as { duplicateIds?: unknown };
    const ids = Array.isArray(parsed.duplicateIds)
      ? parsed.duplicateIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))
      : [];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

/**
 * Find likely duplicate active work orders for a draft create payload.
 * Location is required for any match. AI only runs on same-location candidates.
 */
export async function findLikelyDuplicateWorkOrders(input: {
  draft: Draft;
  activeWorkOrders: WorkOrder[];
}): Promise<DuplicateWorkOrderCandidate[]> {
  const sameLocationOrders = input.activeWorkOrders.filter((wo) =>
    sameLocation(
      { areaId: input.draft.areaId, areaLabel: input.draft.areaLabel },
      { areaId: wo.areaId, areaLabel: wo.areaLabel }
    )
  );

  if (sameLocationOrders.length === 0) return [];

  const structured = sameLocationOrders
    .map((wo) => scoreStructuredMatch(input.draft, wo))
    .filter((row): row is Scored => Boolean(row))
    .sort((a, b) => b.score - a.score);

  const structuredIds = new Set(structured.map((row) => row.workOrder.id));

  // AI only for same-location orders not already clearly matched, or to confirm borderline.
  const aiPool = sameLocationOrders
    .filter((wo) => {
      const scored = structured.find((row) => row.workOrder.id === wo.id);
      return !scored || scored.score < 75;
    })
    .slice(0, MAX_AI_CANDIDATES);

  const aiIds = await semanticMatchIds(input.draft, aiPool);

  const byId = new Map<number, DuplicateWorkOrderCandidate>();

  for (const row of structured) {
    byId.set(row.workOrder.id, {
      id: row.workOrder.id,
      subject: row.workOrder.subject,
      description: row.workOrder.description,
      item: row.workOrder.item,
      areaLabel: row.workOrder.areaLabel,
      areaId: row.workOrder.areaId,
      status: row.workOrder.status,
      createdAt: row.workOrder.createdAt,
      createdBy: row.workOrder.createdBy,
      createdByLabel: row.workOrder.createdByLabel ?? null,
      matchReason: row.matchReason,
    });
  }

  for (const wo of sameLocationOrders) {
    if (!aiIds.has(wo.id)) continue;
    const existing = byId.get(wo.id);
    if (existing) {
      if (!existing.matchReason.includes("Similar meaning")) {
        existing.matchReason = `${existing.matchReason} · Similar meaning`;
      }
      continue;
    }
    byId.set(wo.id, {
      id: wo.id,
      subject: wo.subject,
      description: wo.description,
      item: wo.item,
      areaLabel: wo.areaLabel,
      areaId: wo.areaId,
      status: wo.status,
      createdAt: wo.createdAt,
      createdBy: wo.createdBy,
      createdByLabel: wo.createdByLabel ?? null,
      matchReason: "Same location · Similar meaning",
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aScore = structuredIds.has(a.id) ? 1 : 0;
    const bScore = structuredIds.has(b.id) ? 1 : 0;
    if (aScore !== bScore) return bScore - aScore;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

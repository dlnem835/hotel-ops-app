import {
  WORK_ORDER_ITEM_ISSUES,
  classifyWorkOrderItemIssue,
  type WorkOrderItemIssue,
} from "@/app/maintenance/lib/work-order-item-issues";

/** Stable fingerprint so dismiss survives until the draft text materially changes. */
export function passOnDraftTextFingerprint(
  subject: string,
  message: string
): string {
  return `${subject.trim().toLowerCase()}\n${message.trim().toLowerCase()}`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extra spoken synonyms → catalog detection for the local AI gate.
 * Canonical classification still uses work-order-item-issues.
 */
const ITEM_SYNONYM_PATTERNS: RegExp[] = [
  /\btelevisions?\b/i,
  /\bair\s*condition(?:er|ing)?\b/i,
  /\ba\/?c\b/i,
  /\bptac\b/i,
  /\bhvac\b/i,
  /\blamps?\b/i,
  /\bfixtures?\b/i,
  /\bbulbs?\b/i,
  /\boutlets?\b/i,
  /\breceptacles?\b/i,
  /\bfaucets?\b/i,
  /\bshower\s+valves?\b/i,
  /\bmicrowaves?\b/i,
  /\bcarpets?\b/i,
  /\bwi-?fi\b/i,
  /\bodou?rs?\b/i,
  /\bsmells?\b/i,
  /\bsmelly\b/i,
  /\bstinks?\b/i,
];

/** Build word-boundary patterns from catalog labels (split on "/"). */
function buildCatalogItemPatterns(): RegExp[] {
  const terms = new Set<string>();
  for (const issue of WORK_ORDER_ITEM_ISSUES) {
    if (issue === "Other") continue;
    for (const part of issue.split(/\s*\/\s*/)) {
      const cleaned = part.trim().toLowerCase();
      if (cleaned.length < 2) continue;
      terms.add(cleaned);
    }
  }

  return [...terms].map((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return new RegExp(`\\b${escaped}\\b`, "i");
  });
}

const CATALOG_ITEM_PATTERNS = buildCatalogItemPatterns();

/**
 * Problem / complaint language — paired with a known Item/Issue to open the AI gate.
 */
const PROBLEM_SIGNAL =
  /\b(?:complain(?:ed|t|ing|s)?|broken|break(?:ing)?|issue|problem|trouble|not\s+working|won'?t\s+work|will\s+not\s+work|doesn'?t\s+work|out\s+of\s+order|damage(?:d)?|leak(?:ing|y)?|smell(?:s|y)?|odou?r|noisy|loud|dirty|loose|crack(?:ed)?|clog(?:ged)?|cold|hot|blue(?:\s+screen)?|flicker(?:ing)?|missing|stuck|jammed|weird|strange|bad|won'?t\s+(?:close|open|flush|drain|lock)|will\s+not\s+(?:close|open|flush|drain|lock)|doesn'?t\s+(?:close|open)|not\s+clos(?:e|ing)|not\s+cool(?:ing)?|not\s+heat(?:ing)?|no\s+(?:a\/?c|heat|hot\s+water|power)|dripping|flood(?:ing|ed)?|sparks?|trip(?:ped)?\s+breaker|being\s+blue)\b/i;

/**
 * Strong standalone maintenance phrases — enough to request AI without requiring
 * a separate item+problem pair.
 */
const STRONG_MAINTENANCE_PHRASE =
  /\b(?:leak(?:ing|y)?|no\s+hot\s+water|a\/?c\s+not\s+cool(?:ing)?|hvac\s+not\s+cool(?:ing)?|toilet\s+clog(?:ged)?|tv\s+blue(?:\s+screen)?|blue\s+screen|door\s+won'?t\s+lock|door\s+will\s+not\s+lock|out\s+of\s+order|water\s+on\s+(?:the\s+)?floor)\b/i;

/**
 * Strong “already done” phrasing — skip AI (and suggestions) when this dominates.
 */
const RESOLVED_SIGNAL =
  /\b(?:(?:engineering|maintenance|tech(?:nician)?|vendor|we|i|staff)\s+)?(?:repaired|fixed|resolved|completed|replaced|restored|cleared|addressed)\b|\balready\s+(?:fixed|repaired|resolved|done|completed)\b|\bno\s+longer\b|\bissue\s+(?:is\s+)?(?:fixed|resolved|closed)\b/i;

/**
 * Soft local resolved check before network: skip server call for clear
 * "already fixed" notes.
 */
export function isPassOnMaintenanceLikelyResolved(
  subject: string,
  message: string
): boolean {
  const text = `${subject} ${message}`.trim();
  if (!RESOLVED_SIGNAL.test(text)) return false;
  // Fresh need language overrides a resolved past-tense mention.
  return !/\b(?:still|again|now|needs?|please|guest\s+report)\b/i.test(text);
}

function textMentionsCatalogItem(text: string): boolean {
  if (CATALOG_ITEM_PATTERNS.some((pattern) => pattern.test(text))) return true;
  if (ITEM_SYNONYM_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return classifyWorkOrderItemIssue({ description: text }) !== "Other";
}

function textHasProblemLanguage(text: string): boolean {
  return PROBLEM_SIGNAL.test(text);
}

/**
 * Cheap local gate: does this look like maintenance language worth AI review?
 * Not a final decision — only decides whether to call the server.
 *
 * Opens the gate when:
 * - a known Work Order Item/Issue (catalog or synonym) AND problem/complaint language, or
 * - a strong standalone maintenance phrase
 * and the note is not clearly already resolved.
 */
export function shouldRequestPassOnMaintenanceAi(
  subject: string,
  message: string
): boolean {
  const text = `${subject} ${message}`.trim();
  if (text.length < 8) return false;
  if (isPassOnMaintenanceLikelyResolved(subject, message)) return false;

  if (STRONG_MAINTENANCE_PHRASE.test(text)) return true;

  if (textMentionsCatalogItem(text) && textHasProblemLanguage(text)) {
    return true;
  }

  return false;
}

/** Pull a room-like token for matching Rooms & Areas (no schema change). */
export function extractPassOnRoomHint(
  subject: string,
  message: string
): string | null {
  const text = `${subject} ${message}`;
  const patterns = [
    /\broom\s*#?\s*([A-Za-z0-9-]+)\b/i,
    /\brm\.?\s*#?\s*([A-Za-z0-9-]+)\b/i,
    /\bin\s+(\d{2,4}[A-Za-z]?)\b/i,
    /\b(\d{3,4}[A-Za-z]?)\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function formatPassOnRoomAreaLabel(roomHint: string): string {
  const trimmed = roomHint.trim();
  if (!trimmed) return "";
  if (/^room\s+/i.test(trimmed)) return trimmed;
  return `Room ${trimmed}`;
}

export function isAllowedWorkOrderItemIssue(
  value: string
): value is WorkOrderItemIssue {
  return (WORK_ORDER_ITEM_ISSUES as readonly string[]).includes(value);
}

export type PassOnMaintenanceSuggestion = {
  shouldSuggest: boolean;
  isLikelyResolved: boolean;
  roomHint: string | null;
  itemIssue: WorkOrderItemIssue | null;
  subject: string | null;
  /** Conversational one-liner for the draft bubble, e.g. "This sounds like a TV issue in Room 308." */
  promptLabel: string | null;
  confidence: number;
};

export const EMPTY_PASS_ON_MAINTENANCE_SUGGESTION: PassOnMaintenanceSuggestion = {
  shouldSuggest: false,
  isLikelyResolved: false,
  roomHint: null,
  itemIssue: null,
  subject: null,
  promptLabel: null,
  confidence: 0,
};

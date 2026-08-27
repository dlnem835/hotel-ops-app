import {
  WORK_ORDER_ITEM_ISSUES,
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
 * Cheap local gate: does this look like maintenance language worth AI review?
 * Not a final decision — only decides whether to call the server.
 */
const MAINTENANCE_SIGNAL =
  /\b(?:broken|break(?:ing)?|leak(?:ing|y)?|clog(?:ged)?|damage(?:d)?|loose|stuck|not\s+working|won'?t\s+(?:work|close|open|flush|drain|lock)|will\s+not\s+(?:work|close|open|flush|drain|lock)|doesn'?t\s+(?:work|close|open)|not\s+clos(?:e|ing)|out\s+of\s+order|odor|odour|smell(?:y|s)?|stink|bug(?:s)?|pest(?:s)?|roach(?:es)?|not\s+cool(?:ing)?|not\s+heat(?:ing)?|no\s+(?:a\/?c|heat|hot\s+water|power)|toilet\s+run(?:ning)?|light(?:s)?\s+(?:out|off|flicker)|flicker(?:ing)?|water\s+on\s+(?:the\s+)?floor|flood(?:ing|ed)?|dripping|crack(?:ed)?|missing|jammed|sparks?|trip(?:ped)?\s+breaker)\b/i;

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

export function shouldRequestPassOnMaintenanceAi(
  subject: string,
  message: string
): boolean {
  const text = `${subject} ${message}`.trim();
  if (text.length < 12) return false;
  if (!MAINTENANCE_SIGNAL.test(text)) return false;
  if (isPassOnMaintenanceLikelyResolved(subject, message)) return false;
  return true;
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
  /** Short phrase for the banner, e.g. "Shower Door in Room 303" */
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

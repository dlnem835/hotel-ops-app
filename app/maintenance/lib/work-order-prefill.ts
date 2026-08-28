import {
  classifyWorkOrderItemIssue,
  isWorkOrderItemIssue,
  type WorkOrderItemIssue,
} from "@/app/maintenance/lib/work-order-item-issues";
import type {
  WorkOrderInput,
  WorkOrderPriority,
} from "@/app/maintenance/lib/maintenance-types";

/** Canonical source_module values written on create from structured workflows. */
export const WORK_ORDER_SOURCE = {
  ROOM_INSPECTION: "Room Inspection",
  RPM_INSPECTION: "RPM Inspection",
  PREVENTIVE_MAINTENANCE: "Preventive Maintenance",
  PASS_ON_LOG: "Pass-On Log",
  MANUAL: "Maintenance",
} as const;

export type WorkOrderPrefill = Partial<WorkOrderInput> & {
  subject: string;
  lock_location?: boolean;
};

function trimText(value: string | null | undefined): string {
  return String(value || "").trim();
}

/** Topic before ":" for inspection questions, else full label. */
export function shortFailedItemLabel(label: string | null | undefined): string {
  const raw = trimText(label);
  if (!raw) return "Failed item";
  const topic = raw.split(":")[0]?.trim();
  return topic || raw;
}

function joinBreadcrumb(parts: Array<string | null | undefined>): string {
  return parts.map(trimText).filter(Boolean).join(" · ");
}

function formatRoomLabel(roomHint: string | null | undefined): string | null {
  const hint = trimText(roomHint);
  if (!hint) return null;
  return /^room\s+/i.test(hint) ? hint : `Room ${hint}`;
}

/**
 * Detected maintenance conditions → concise Details shorthand.
 * Prefer short labels; do not build full sentences.
 */
const CONDITION_EXTRACTORS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bblue\s+screen\b/i, label: "Blue screen" },
  { pattern: /\bscreen\s+is\s+blue\b|\bbeing\s+blue\b|\bis\s+blue\b/i, label: "Blue screen" },
  { pattern: /\bnot\s+cool(?:ing)?\b/i, label: "Not cooling" },
  { pattern: /\bnot\s+heat(?:ing)?\b/i, label: "Not heating" },
  { pattern: /\bno\s+hot\s+water\b/i, label: "No hot water" },
  { pattern: /\bout\s+of\s+order\b/i, label: "Out of order" },
  { pattern: /\bwon'?t\s+lock\b|\bwill\s+not\s+lock\b|\bdoesn'?t\s+lock\b/i, label: "Won't lock" },
  { pattern: /\bwon'?t\s+close\b|\bwill\s+not\s+close\b|\bnot\s+clos(?:e|ing)\b/i, label: "Won't close" },
  { pattern: /\bwon'?t\s+open\b|\bwill\s+not\s+open\b/i, label: "Won't open" },
  { pattern: /\bwon'?t\s+(?:work|flush|drain)\b|\bnot\s+working\b|\bdoesn'?t\s+work\b/i, label: "Not working" },
  { pattern: /\bflicker(?:ing)?\b/i, label: "Flickering" },
  { pattern: /\bleak(?:ing|y)?\b/i, label: "Leaking" },
  { pattern: /\bclog(?:ged)?\b/i, label: "Clogged" },
  { pattern: /\bbroken\b/i, label: "Broken" },
  { pattern: /\bdamage(?:d)?\b/i, label: "Damaged" },
  { pattern: /\bloose\b/i, label: "Loose" },
  { pattern: /\bstuck\b|\bjammed\b/i, label: "Stuck" },
  { pattern: /\bmissing\b/i, label: "Missing" },
  { pattern: /\bcrack(?:ed)?\b/i, label: "Cracked" },
  { pattern: /\b(?:odor|odour|smell(?:s|y)?|stink)\b/i, label: "Odor / smell" },
  { pattern: /\bnoisy\b|\bloud\b/i, label: "Noisy" },
  { pattern: /\bdirty\b/i, label: "Dirty" },
  { pattern: /\bdripping\b/i, label: "Dripping" },
  { pattern: /\bflood(?:ing|ed)?\b/i, label: "Flooding" },
];

/**
 * Build concise Details from source text: conditions only, no room/location
 * echo, no full narrative copy.
 */
export function extractConciseMaintenanceDetails(
  text: string | null | undefined,
  options?: { maxChars?: number }
): string {
  const raw = trimText(text);
  if (!raw) return "";

  const found: string[] = [];
  const seen = new Set<string>();
  for (const { pattern, label } of CONDITION_EXTRACTORS) {
    if (!pattern.test(raw)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(label);
  }

  if (found.length > 0) {
    return found.join(" / ");
  }

  // Short free-text notes (inspector/PM comments) — keep if already concise.
  const maxChars = options?.maxChars ?? 80;
  const withoutRoomNoise = raw
    .replace(/\broom\s*#?\s*[A-Za-z0-9-]+\b/gi, " ")
    .replace(/\b(?:rm\.?)\s*#?\s*[A-Za-z0-9-]+\b/gi, " ")
    .replace(/\b\d{2,4}[A-Za-z]?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutRoomNoise) return "";
  if (withoutRoomNoise.length <= maxChars) return withoutRoomNoise;

  return `${withoutRoomNoise.slice(0, maxChars - 1).trim()}…`;
}

function buildPassOnSubject(
  item: WorkOrderItemIssue,
  roomLabel: string | null,
  fallbackSubject?: string | null
): string {
  const itemPart =
    item !== "Other" ? `${item} Issue` : trimText(fallbackSubject) || "Maintenance issue";
  if (roomLabel) return `${itemPart} – ${roomLabel}`;
  return itemPart;
}

/**
 * Room / RPM inspection failed item → Work Order prefill.
 * Details = concise fail notes/conditions; full context stays in source_note.
 */
export function buildInspectionWorkOrderPrefill(input: {
  program: "Room" | "RPM" | string;
  sessionId: number | string;
  templateName: string;
  categoryName: string;
  itemLabel: string;
  notes?: string | null;
  photoUrl?: string | null;
  areaId?: number | null;
  roomName?: string | null;
  createdBy?: string | null;
}): WorkOrderPrefill {
  const shortLabel = shortFailedItemLabel(input.itemLabel);
  const notes = trimText(input.notes);
  const item = classifyWorkOrderItemIssue({
    structuredItem: input.itemLabel,
    description: notes,
    details: shortLabel,
  });
  const isRpm =
    String(input.program).toUpperCase() === "RPM" ||
    String(input.program) === "RPM Inspection";
  const roomLabel = input.roomName ? `Room ${input.roomName}` : null;
  const details = extractConciseMaintenanceDetails(notes);

  return {
    subject: roomLabel ? `${shortLabel} – ${roomLabel}` : shortLabel,
    description: details,
    item,
    priority: "Important",
    area_id: input.areaId ?? null,
    area_label: roomLabel,
    source_module: isRpm
      ? WORK_ORDER_SOURCE.RPM_INSPECTION
      : WORK_ORDER_SOURCE.ROOM_INSPECTION,
    source_record_id: String(input.sessionId),
    source_note: joinBreadcrumb([
      input.templateName,
      input.categoryName,
      input.itemLabel,
      notes || null,
    ]),
    photo_url: input.photoUrl || null,
    created_by: input.createdBy ?? null,
  };
}

/**
 * Single-occurrence PM checklist step fail → Work Order prefill.
 */
export function buildPmChecklistWorkOrderPrefill(input: {
  templateName: string;
  stepLabel: string;
  occurrenceId: number | string;
  notes?: string | null;
  photoUrl?: string | null;
  areaId?: number | null;
  areaName?: string | null;
  assetLabel?: string | null;
  createdBy?: string | null;
}): WorkOrderPrefill {
  const notes = trimText(input.notes);
  const location =
    input.areaName && input.assetLabel
      ? `${input.assetLabel} — ${input.areaName}`
      : input.areaName || input.assetLabel || null;

  const item = classifyWorkOrderItemIssue({
    structuredItem: input.templateName,
    description: [input.assetLabel, input.stepLabel, notes]
      .filter(Boolean)
      .join(" "),
    details: input.stepLabel,
  });

  const subjectBase = trimText(input.templateName) || "Preventive Maintenance";
  const details =
    extractConciseMaintenanceDetails(notes) ||
    extractConciseMaintenanceDetails(input.stepLabel);

  return {
    subject: `${subjectBase}: ${shortFailedItemLabel(input.stepLabel)}`,
    description: details,
    item,
    priority: "Important",
    area_id: input.areaId ?? null,
    area_label: location,
    source_module: WORK_ORDER_SOURCE.PREVENTIVE_MAINTENANCE,
    source_record_id: String(input.occurrenceId),
    source_note: joinBreadcrumb([
      input.templateName,
      input.assetLabel,
      input.stepLabel,
      notes || null,
    ]),
    photo_url: input.photoUrl || null,
    created_by: input.createdBy ?? null,
  };
}

/**
 * Multi-target PM program fail on a location/asset → Work Order prefill.
 */
export function buildPmProgramTargetWorkOrderPrefill(input: {
  templateName: string;
  targetLabel: string;
  occurrenceId?: number | string | null;
  templateId: number | string;
  notes?: string | null;
  photoUrl?: string | null;
  areaId?: number | null;
  createdBy?: string | null;
}): WorkOrderPrefill {
  const notes = trimText(input.notes);
  const templateName = trimText(input.templateName) || "Preventive Maintenance";
  const item = classifyWorkOrderItemIssue({
    structuredItem: templateName,
    description: [input.targetLabel, notes].filter(Boolean).join(" "),
    details: input.targetLabel,
  });

  return {
    subject: `${templateName}: ${input.targetLabel}`,
    description: extractConciseMaintenanceDetails(notes),
    item,
    priority: "Important",
    area_id: input.areaId ?? null,
    area_label: input.targetLabel,
    lock_location: true,
    source_module: WORK_ORDER_SOURCE.PREVENTIVE_MAINTENANCE,
    source_record_id: input.occurrenceId
      ? String(input.occurrenceId)
      : String(input.templateId),
    source_note: joinBreadcrumb([
      templateName,
      input.targetLabel,
      notes || null,
    ]),
    photo_url: input.photoUrl || null,
    created_by: input.createdBy ?? null,
  };
}

/**
 * Pass-On entry (posted) → Work Order prefill. Structured classify only (no AI).
 */
export function buildPassOnEntryWorkOrderPrefill(input: {
  entryId: number | string;
  subject: string;
  message: string;
  priority?: WorkOrderPriority | string | null;
  createdBy?: string | null;
  roomHint?: string | null;
  itemIssue?: string | null;
}): WorkOrderPrefill {
  const passOnSubject = trimText(input.subject) || "Pass-On";
  const message = trimText(input.message);
  const sourceText = [passOnSubject, message].filter(Boolean).join(" ");
  const item = isWorkOrderItemIssue(String(input.itemIssue || "").trim())
    ? (input.itemIssue as WorkOrderItemIssue)
    : classifyWorkOrderItemIssue({
        structuredItem: input.itemIssue,
        description: message,
        details: passOnSubject,
      });

  const priority =
    input.priority === "Urgent" || input.priority === "Important"
      ? input.priority
      : "Normal";

  const roomLabel = formatRoomLabel(input.roomHint);

  return {
    subject: buildPassOnSubject(item, roomLabel, passOnSubject),
    description: extractConciseMaintenanceDetails(sourceText),
    item,
    priority,
    area_label: roomLabel,
    source_module: WORK_ORDER_SOURCE.PASS_ON_LOG,
    source_record_id: String(input.entryId),
    source_note: message || passOnSubject,
    created_by: input.createdBy ?? null,
  };
}

/**
 * Pass-On draft suggestion → Work Order prefill (AI may supply item/room;
 * still opens modal for review — never auto-creates).
 */
export function buildPassOnDraftWorkOrderPrefill(input: {
  draftSubject: string;
  draftMessage: string;
  draftPriority?: string | null;
  itemIssue?: string | null;
  suggestedSubject?: string | null;
  roomHint?: string | null;
  createdBy?: string | null;
}): WorkOrderPrefill {
  const draftSubject = trimText(input.draftSubject);
  const draftMessage = trimText(input.draftMessage);
  const sourceText = [draftSubject, draftMessage].filter(Boolean).join(" ");
  const item = isWorkOrderItemIssue(String(input.itemIssue || "").trim())
    ? (input.itemIssue as WorkOrderItemIssue)
    : classifyWorkOrderItemIssue({
        structuredItem: input.itemIssue,
        description: draftMessage,
        details: draftSubject,
      });

  const priority =
    input.draftPriority === "Urgent" || input.draftPriority === "Important"
      ? input.draftPriority
      : "Normal";

  const roomLabel = formatRoomLabel(input.roomHint);

  return {
    subject: buildPassOnSubject(
      item,
      roomLabel,
      trimText(input.suggestedSubject) || draftSubject
    ),
    description: extractConciseMaintenanceDetails(sourceText),
    item,
    priority,
    area_label: roomLabel,
    source_module: WORK_ORDER_SOURCE.PASS_ON_LOG,
    source_note: draftMessage || draftSubject,
    created_by: input.createdBy ?? null,
  };
}

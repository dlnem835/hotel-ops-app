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

function buildDetailsFromNotes(
  notes: string | null | undefined,
  fallback: string
): string {
  const trimmed = trimText(notes);
  return trimmed || fallback;
}

function joinBreadcrumb(parts: Array<string | null | undefined>): string {
  return parts.map(trimText).filter(Boolean).join(" · ");
}

/**
 * Room / RPM inspection failed item → Work Order prefill.
 * Uses structured inspection data only (no AI).
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

  return {
    subject: shortLabel,
    description: buildDetailsFromNotes(
      notes,
      `Failed inspection item: ${shortLabel}`
    ),
    item,
    priority: "Important",
    area_id: input.areaId ?? null,
    area_label: input.roomName ? `Room ${input.roomName}` : null,
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

  return {
    subject: `${subjectBase}: ${shortFailedItemLabel(input.stepLabel)}`,
    description: buildDetailsFromNotes(
      notes,
      `Failed PM step: ${input.stepLabel}`
    ),
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
    description: buildDetailsFromNotes(
      notes,
      `Failed PM target: ${input.targetLabel}`
    ),
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
  const subject = trimText(input.subject) || "Pass-On";
  const message = trimText(input.message);
  const item = isWorkOrderItemIssue(String(input.itemIssue || "").trim())
    ? (input.itemIssue as WorkOrderItemIssue)
    : classifyWorkOrderItemIssue({
        structuredItem: input.itemIssue,
        description: message,
        details: subject,
      });

  const priority =
    input.priority === "Urgent" || input.priority === "Important"
      ? input.priority
      : "Normal";

  const roomHint = trimText(input.roomHint);
  const areaLabel = roomHint
    ? /^room\s+/i.test(roomHint)
      ? roomHint
      : `Room ${roomHint}`
    : null;

  return {
    subject,
    description: message || subject,
    item,
    priority,
    area_label: areaLabel,
    source_module: WORK_ORDER_SOURCE.PASS_ON_LOG,
    source_record_id: String(input.entryId),
    source_note: message || subject,
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

  const areaLabel = input.roomHint
    ? /^room\s+/i.test(input.roomHint.trim())
      ? input.roomHint.trim()
      : `Room ${input.roomHint.trim()}`
    : null;

  return {
    subject:
      trimText(input.suggestedSubject) ||
      draftSubject ||
      item ||
      "Maintenance issue",
    description: draftMessage || draftSubject,
    item,
    priority,
    area_label: areaLabel,
    source_module: WORK_ORDER_SOURCE.PASS_ON_LOG,
    source_note: draftMessage || draftSubject,
    created_by: input.createdBy ?? null,
  };
}

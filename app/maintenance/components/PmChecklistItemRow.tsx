"use client";

import { Check, Minus, X } from "lucide-react";
import FailedItemDetails from "@/app/inspections/components/FailedItemDetails";
import CreateWorkOrderButton from "@/app/maintenance/components/CreateWorkOrderButton";
import { WorkOrderModalInitialValues } from "@/app/maintenance/components/WorkOrderModal";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { SETTINGS_BUTTON_BASE } from "@/app/settings/lib/settings-ui-interactions";
import { PmChecklistStep, PmStepOutcome } from "../lib/pm-types";

export type PmFailedItemWorkOrderContext = {
  templateName: string;
  occurrenceId: number;
  areaId: number | null;
  areaName: string | null;
  assetLabel: string | null;
  completedBy: string | null;
  onCreateWorkOrder: (initial: WorkOrderModalInitialValues) => void;
};

type PmChecklistItemRowProps = {
  step: PmChecklistStep;
  index: number;
  outcome: PmStepOutcome | null;
  notes: string;
  photoUrl: string | null;
  readOnly?: boolean;
  uploading?: boolean;
  workOrderContext?: PmFailedItemWorkOrderContext;
  onOutcomeChange: (outcome: PmStepOutcome) => void;
  onNotesChange: (value: string) => void;
  onPhotoSelect: (file: File) => void;
  onPhotoRemove: () => void;
};

function locationLabel(context: PmFailedItemWorkOrderContext): string | null {
  if (context.areaName && context.assetLabel) {
    return `${context.areaName} · ${context.assetLabel}`;
  }
  return context.areaName || context.assetLabel || null;
}

export default function PmChecklistItemRow({
  step,
  index,
  outcome,
  notes,
  photoUrl,
  readOnly = false,
  uploading = false,
  workOrderContext,
  onOutcomeChange,
  onNotesChange,
  onPhotoSelect,
  onPhotoRemove,
}: PmChecklistItemRowProps) {
  return (
    <div
      style={{
        padding: "12px",
        borderRadius: "8px",
        background: index % 2 === 0 ? ONE_EYRIE.row : ONE_EYRIE.surfaceInset,
        border: `1px solid ${outcome === "fail" ? FLAT_RED.border : ONE_EYRIE.borderDivider}`,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ fontWeight: 700, lineHeight: 1.45, color: ONE_EYRIE.text }}>
            {step.label}
          </div>
        </div>

        {!readOnly && (
          <div style={{ display: "flex", gap: "6px" }}>
            {(
              [
                ["pass", "Pass", Check, FOREST],
                ["fail", "Fail", X, FLAT_RED],
                ["na", "N/A", Minus, { border: "#5A5A5A", bg: "#242424", text: "#9CA3AF" }],
              ] as const
            ).map(([value, label, Icon, palette]) => {
              const active = outcome === value;
              const colors =
                value === "pass"
                  ? { border: FOREST.border, bg: FOREST.bg, text: FOREST.text }
                  : palette;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onOutcomeChange(value)}
                  style={{
                    ...SETTINGS_BUTTON_BASE,
                    minWidth: "64px",
                    height: "36px",
                    borderRadius: "8px",
                    border: `1px solid ${active ? ONE_EYRIE.gold : colors.border}`,
                    background: active ? colors.bg : "transparent",
                    color: active ? colors.text : ONE_EYRIE.textSubtle,
                    fontWeight: 800,
                    fontSize: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {readOnly && outcome && (
          <div
            style={{
              fontWeight: 800,
              fontSize: "12px",
              color:
                outcome === "pass"
                  ? FOREST.text
                  : outcome === "fail"
                    ? FLAT_RED.text
                    : ONE_EYRIE.textSubtle,
              textTransform: "uppercase",
            }}
          >
            {outcome === "na" ? "N/A" : outcome}
          </div>
        )}
      </div>

      {outcome === "fail" && (
        <>
          <FailedItemDetails
            notes={notes}
            photoUrl={photoUrl}
            readOnly={readOnly}
            uploading={uploading}
            photoEnabled
            onNotesChange={onNotesChange}
            onPhotoSelect={onPhotoSelect}
            onPhotoRemove={onPhotoRemove}
          />
          {!readOnly && workOrderContext && (
            <div style={{ marginTop: "10px" }}>
              <CreateWorkOrderButton
                compact
                label="Create Work Order"
                onOpen={() =>
                  workOrderContext.onCreateWorkOrder({
                    subject: `PM fail: ${step.label}`,
                    description: notes || "",
                    priority: "Important",
                    area_id: workOrderContext.areaId,
                    area_label: locationLabel(workOrderContext),
                    source_module: "Maintenance",
                    source_record_id: String(workOrderContext.occurrenceId),
                    source_note: `${workOrderContext.templateName} · ${step.label}${
                      notes ? ` — ${notes}` : ""
                    }`,
                    created_by: workOrderContext.completedBy,
                  })
                }
                initialValues={{
                  subject: `PM fail: ${step.label}`,
                  description: notes || "",
                  priority: "Important",
                  area_id: workOrderContext.areaId,
                  area_label: locationLabel(workOrderContext),
                  source_module: "Maintenance",
                  source_record_id: String(workOrderContext.occurrenceId),
                  source_note: `${workOrderContext.templateName} · ${step.label}${
                    notes ? ` — ${notes}` : ""
                  }`,
                  created_by: workOrderContext.completedBy,
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

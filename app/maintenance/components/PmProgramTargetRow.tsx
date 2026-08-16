"use client";

import { Check, Minus, X } from "lucide-react";
import FailedItemDetails from "@/app/inspections/components/FailedItemDetails";
import { toggleSelectedOutcome } from "@/app/lib/outcome-toggle";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { SETTINGS_BUTTON_BASE } from "@/app/settings/lib/settings-ui-interactions";
import type { PmTargetOutcome } from "../lib/maintenance-types";
import CreateWorkOrderButton from "./CreateWorkOrderButton";
import type { WorkOrderModalInitialValues } from "./WorkOrderModal";

type PmProgramTargetRowProps = {
  index: number;
  name: string;
  location: string | null;
  outcome: PmTargetOutcome | null;
  notes: string;
  photoUrl: string | null;
  readOnly: boolean;
  uploading: boolean;
  workOrderInitial: WorkOrderModalInitialValues;
  onOutcomeChange: (outcome: PmTargetOutcome | null) => void;
  onNotesChange: (value: string) => void;
  onPhotoSelect: (file: File) => void;
  onPhotoRemove: () => void;
  onCreateWorkOrder: (initial: WorkOrderModalInitialValues) => void;
};

export default function PmProgramTargetRow({
  index,
  name,
  location,
  outcome,
  notes,
  photoUrl,
  readOnly,
  uploading,
  workOrderInitial,
  onOutcomeChange,
  onNotesChange,
  onPhotoSelect,
  onPhotoRemove,
  onCreateWorkOrder,
}: PmProgramTargetRowProps) {
  return (
    <div
      style={{
        padding: "12px",
        borderRadius: "8px",
        background:
          index % 2 === 0 ? ONE_EYRIE.row : ONE_EYRIE.surfaceInset,
        border: `1px solid ${
          outcome === "fail"
            ? FLAT_RED.border
            : outcome === "pass"
              ? FOREST.border
              : ONE_EYRIE.borderDivider
        }`,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div
            style={{
              color: ONE_EYRIE.text,
              fontWeight: 800,
              lineHeight: 1.4,
            }}
          >
            {name}
          </div>
          {location ? (
            <div
              style={{
                color: ONE_EYRIE.textMuted,
                fontSize: "12px",
                marginTop: "2px",
              }}
            >
              {location}
            </div>
          ) : null}
        </div>

        {!readOnly ? (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {(
              [
                ["pass", "Pass", Check, FOREST],
                ["fail", "Fail", X, FLAT_RED],
                [
                  "na",
                  "N/A",
                  Minus,
                  { border: "#5A5A5A", bg: "#242424", text: "#9CA3AF" },
                ],
              ] as const
            ).map(([value, label, Icon, palette]) => {
              const active = outcome === value;
              const colors =
                value === "pass"
                  ? {
                      border: FOREST.border,
                      bg: FOREST.bg,
                      text: FOREST.text,
                    }
                  : palette;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    onOutcomeChange(
                      toggleSelectedOutcome(outcome, value) ?? null
                    )
                  }
                  style={{
                    ...SETTINGS_BUTTON_BASE,
                    minWidth: "64px",
                    height: "36px",
                    borderRadius: "8px",
                    border: `1px solid ${
                      active ? ONE_EYRIE.gold : colors.border
                    }`,
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
        ) : outcome ? (
          <div
            style={{
              color:
                outcome === "pass"
                  ? FOREST.text
                  : outcome === "fail"
                    ? FLAT_RED.text
                    : ONE_EYRIE.textSubtle,
              fontSize: "12px",
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            {outcome === "na" ? "N/A" : outcome}
          </div>
        ) : null}
      </div>

      {outcome === "fail" ? (
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
          {!readOnly ? (
            <div style={{ marginTop: "10px" }}>
              <CreateWorkOrderButton
                compact
                label="Create Work Order"
                initialValues={workOrderInitial}
                onOpen={(initial) => onCreateWorkOrder(initial || workOrderInitial)}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

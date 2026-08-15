"use client";

import { Check, Minus, X } from "lucide-react";
import FailedItemDetails from "@/app/inspections/components/FailedItemDetails";
import { FLAT_RED, FOREST, NEUTRAL_PILL, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { SETTINGS_BUTTON_BASE } from "@/app/settings/lib/settings-ui-interactions";
import { PropertyItem } from "@/app/inspections/standards/types";
import { InspectionItemGuidanceHeading } from "@/app/inspections/components/InspectionGuidance";

type Outcome = "pass" | "fail" | "na";

const OUTCOME_PALETTES = {
  pass: {
    border: FOREST.border,
    idleBg: FOREST.bgSoft,
    activeBg: FOREST.bg,
    idleText: "#8FB5A3",
    activeText: FOREST.text,
  },
  fail: {
    border: FLAT_RED.border,
    idleBg: "rgba(139, 82, 82, 0.22)",
    activeBg: FLAT_RED.bg,
    idleText: "#C9A8A8",
    activeText: FLAT_RED.text,
  },
  na: {
    border: NEUTRAL_PILL.border,
    idleBg: "#2A2A2A",
    activeBg: "#242424",
    idleText: NEUTRAL_PILL.text,
    activeText: ONE_EYRIE.textRow,
  },
} as const;

type MobileInspectionItemCardProps = {
  item: PropertyItem;
  outcome: Outcome | undefined;
  notes: string;
  photoUrl: string | null;
  readOnly?: boolean;
  uploading?: boolean;
  displayGuidance?: {
    label: string;
    inspect: readonly string[];
    expanded: boolean;
    onToggle: () => void;
  };
  onOutcomeChange: (outcome: Outcome) => void;
  onNotesChange: (value: string) => void;
  onPhotoSelect: (file: File) => void;
  onPhotoRemove: () => void;
  workOrderButton?: React.ReactNode;
};

export default function MobileInspectionItemCard({
  item,
  outcome,
  notes,
  photoUrl,
  readOnly = false,
  uploading = false,
  displayGuidance,
  onOutcomeChange,
  onNotesChange,
  onPhotoSelect,
  onPhotoRemove,
  workOrderButton,
}: MobileInspectionItemCardProps) {
  const guidanceExpanded = Boolean(displayGuidance?.expanded);

  function handleCardClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!displayGuidance) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("button, a, input, textarea, select, label, [data-inspection-card-control]")
    ) {
      return;
    }
    displayGuidance.onToggle();
  }

  return (
    <div
      className={`one-eyrie-mobile-inspection-item${
        displayGuidance ? " one-eyrie-mobile-inspection-item--expandable" : ""
      }${guidanceExpanded ? " one-eyrie-mobile-inspection-item--expanded" : ""}`}
      onClick={displayGuidance ? handleCardClick : undefined}
    >
      <div className="one-eyrie-mobile-inspection-item__prompt">
        <div className="one-eyrie-mobile-inspection-item__label">
          {displayGuidance ? (
            <InspectionItemGuidanceHeading
              label={displayGuidance.label}
              inspect={displayGuidance.inspect}
              expanded={displayGuidance.expanded}
              onToggle={displayGuidance.onToggle}
            />
          ) : (
            item.label.en
          )}
        </div>
        <div className="one-eyrie-mobile-inspection-item__meta">
          Weight {item.pointValue}
          {item.required ? " · Required" : ""}
        </div>
      </div>

      {!readOnly ? (
        <div className="one-eyrie-mobile-inspection-outcomes">
          {(
            [
              ["pass", "Pass", Check],
              ["fail", "Fail", X],
              ["na", "N/A", Minus],
            ] as const
          ).map(([value, label, Icon]) => {
            const active = outcome === value;
            const palette = OUTCOME_PALETTES[value];

            return (
              <button
                key={value}
                type="button"
                className="one-eyrie-mobile-inspection-outcome-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  onOutcomeChange(value);
                }}
                style={{
                  ...SETTINGS_BUTTON_BASE,
                  border: `1.5px solid ${active ? ONE_EYRIE.gold : palette.border}`,
                  background: active ? palette.activeBg : palette.idleBg,
                  color: active ? palette.activeText : palette.idleText,
                }}
              >
                <Icon size={15} strokeWidth={2.5} />
                {label}
              </button>
            );
          })}
        </div>
      ) : outcome ? (
        <div
          className="one-eyrie-mobile-inspection-item__readonly-outcome"
          style={{
            color:
              outcome === "pass"
                ? FOREST.text
                : outcome === "fail"
                  ? FLAT_RED.text
                  : ONE_EYRIE.textSubtle,
          }}
        >
          {outcome === "na" ? "N/A" : outcome.toUpperCase()}
        </div>
      ) : null}

      {outcome === "fail" ? (
        <div data-inspection-card-control onClick={(event) => event.stopPropagation()}>
          <FailedItemDetails
            notes={notes}
            photoUrl={photoUrl}
            readOnly={readOnly}
            uploading={uploading}
            onNotesChange={onNotesChange}
            onPhotoSelect={onPhotoSelect}
            onPhotoRemove={onPhotoRemove}
          />
          {workOrderButton ? (
            <div className="one-eyrie-mobile-inspection-item__work-order">{workOrderButton}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

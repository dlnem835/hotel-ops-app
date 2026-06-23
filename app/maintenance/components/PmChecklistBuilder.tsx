"use client";

import { Plus, Trash2 } from "lucide-react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  secondaryHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";
import { PmChecklistStep } from "../lib/pm-types";

type PmChecklistBuilderProps = {
  steps: PmChecklistStep[];
  inputStyle: React.CSSProperties;
  secondaryButton: React.CSSProperties;
  onChange: (steps: PmChecklistStep[]) => void;
};

export default function PmChecklistBuilder({
  steps,
  inputStyle,
  secondaryButton,
  onChange,
}: PmChecklistBuilderProps) {
  const labelStyle: React.CSSProperties = {
    display: "block",
    color: "#C9C9C9",
    fontSize: "12px",
    fontWeight: 700,
    marginBottom: "6px",
  };

  function updateStep(index: number, patch: Partial<PmChecklistStep>) {
    onChange(
      steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step
      )
    );
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    onChange(steps.filter((_, stepIndex) => stepIndex !== index));
  }

  function addStep() {
    onChange([
      ...steps,
      {
        key: `step-${Date.now()}`,
        label: "",
        required: true,
        photoRequiredOnFail: false,
        sortOrder: steps.length,
      },
    ]);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <span style={labelStyle}>Checklist</span>
        <button
          type="button"
          onClick={addStep}
          style={{
            ...SETTINGS_BUTTON_BASE,
            ...secondaryButton,
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px",
            fontSize: "12px",
          }}
          {...secondaryHoverHandlers()}
        >
          <Plus size={14} />
          Add step
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {steps.map((step, index) => (
          <div
            key={`${step.key}-${index}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: "8px",
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: "10px",
              border: `1px solid ${ONE_EYRIE.border}`,
              background: ONE_EYRIE.surfacePanel,
            }}
          >
            <input
              value={step.label}
              onChange={(e) => updateStep(index, { label: e.target.value })}
              placeholder="Checklist step"
              style={inputStyle}
            />
            <label
              style={{
                color: ONE_EYRIE.textSubtle,
                fontSize: "11px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={step.photoRequiredOnFail}
                onChange={(e) =>
                  updateStep(index, { photoRequiredOnFail: e.target.checked })
                }
              />
              Photo on fail
            </label>
            <button
              type="button"
              onClick={() => removeStep(index)}
              disabled={steps.length <= 1}
              title="Remove step"
              style={{
                ...SETTINGS_BUTTON_BASE,
                border: "none",
                background: "transparent",
                color: ONE_EYRIE.textMuted,
                opacity: steps.length <= 1 ? 0.4 : 1,
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

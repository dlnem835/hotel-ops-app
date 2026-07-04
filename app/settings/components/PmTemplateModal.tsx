"use client";

import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import PmChecklistBuilder from "@/app/maintenance/components/PmChecklistBuilder";
import PmWorkloadDatePicker from "@/app/maintenance/components/PmWorkloadDatePicker";
import {
  emptyChecklist,
  getFlatChecklistSteps,
  normalizeChecklist,
  rekeyChecklist,
  stepsToChecklist,
} from "@/app/maintenance/lib/pm-checklist-draft";
import {
  PM_CUSTOM_AREA_VALUE,
  sortPmAreaOptions,
} from "@/app/maintenance/lib/pm-category";
import {
  PM_FREQUENCIES,
  PM_FREQUENCY_LABELS,
  PmChecklistStep,
  PmAssignmentSchedule,
  PmTemplateInput,
} from "@/app/maintenance/lib/pm-types";
import { BuildingArea } from "../lib/buildings-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  goldFilledHoverHandlers,
  goldHoverHandlers,
  GOLD_OUTLINE_BUTTON,
  neutralHoverHandlers,
} from "../lib/settings-ui-interactions";

type PmTemplateModalProps = {
  open: boolean;
  editingId: number | null;
  isDuplicate?: boolean;
  areas: BuildingArea[];
  schedules: PmAssignmentSchedule[];
  initial?: Partial<PmTemplateInput> & { id?: number };
  styles: Record<string, React.CSSProperties>;
  onClose: () => void;
  onSaved: () => void;
};

type AreaMode = "area" | "custom";

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyForm(): PmTemplateInput {
  return {
    name: "",
    description: "",
    frequency: "monthly",
    checklist: emptyChecklist(),
    status: "Active",
    assignment: {
      area_id: null,
      asset_label: null,
      start_date: getLocalDateString(),
      end_date: null,
      status: "Active",
    },
  };
}

export default function PmTemplateModal({
  open,
  editingId,
  isDuplicate = false,
  areas,
  schedules,
  initial,
  styles,
  onClose,
  onSaved,
}: PmTemplateModalProps) {
  const {
    modalOverlay,
    modalBox,
    modalHeader,
    closeButton,
    formStack,
    twoCol,
    input,
    modalFooter,
    primaryButton,
    secondaryButton,
  } = styles;

  const [saving, setSaving] = useState(false);
  const [noEndDate, setNoEndDate] = useState(true);
  const [form, setForm] = useState<PmTemplateInput>(emptyForm());
  const [areaMode, setAreaMode] = useState<AreaMode>("area");
  const [customAreaLabel, setCustomAreaLabel] = useState("");

  useEffect(() => {
    if (!open) return;

    if (initial) {
      const checklist = normalizeChecklist(initial.checklist || emptyChecklist());
      const hasCustomArea =
        Boolean(initial.assignment?.asset_label?.trim()) &&
        !initial.assignment?.area_id;

      setForm({
        name: initial.name || "",
        description: initial.description || "",
        frequency: initial.frequency || "monthly",
        checklist,
        status: initial.status || "Active",
        assignment: {
          area_id: initial.assignment?.area_id ?? null,
          asset_label: initial.assignment?.asset_label ?? null,
          start_date: initial.assignment?.start_date || getLocalDateString(),
          end_date: initial.assignment?.end_date ?? null,
          status: initial.assignment?.status || "Active",
        },
      });
      setAreaMode(hasCustomArea ? "custom" : "area");
      setCustomAreaLabel(
        hasCustomArea ? initial.assignment?.asset_label || "" : ""
      );
      setNoEndDate(!initial.assignment?.end_date);
      return;
    }

    setForm(emptyForm());
    setAreaMode("area");
    setCustomAreaLabel("");
    setNoEndDate(true);
  }, [open, initial]);

  const areaOptions = useMemo(
    () =>
      sortPmAreaOptions(
        areas.filter((area) => area.area_type !== "Guest Room")
      ),
    [areas]
  );

  const draftPm = useMemo(
    () => ({
      name: form.name,
      frequency: form.frequency,
    }),
    [form.name, form.frequency]
  );

  if (!open) return null;

  const checklistSteps = getFlatChecklistSteps(form.checklist);

  function updateForm(patch: Partial<PmTemplateInput>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function updateAssignment(patch: Partial<PmTemplateInput["assignment"]>) {
    setForm((prev) => ({
      ...prev,
      assignment: { ...prev.assignment, ...patch },
    }));
  }

  function updateChecklistSteps(steps: PmChecklistStep[]) {
    updateForm({ checklist: stepsToChecklist(steps) });
  }

  function handleAreaSelection(value: string) {
    if (value === PM_CUSTOM_AREA_VALUE) {
      setAreaMode("custom");
      updateAssignment({ area_id: null });
      return;
    }

    setAreaMode("area");
    setCustomAreaLabel("");
    updateAssignment({
      area_id: value ? Number(value) : null,
      asset_label: null,
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert("PM template name is required.");
      return;
    }

    if (areaMode === "area" && !form.assignment.area_id) {
      alert("Select an area or choose Custom Area / Utility PM.");
      return;
    }

    if (areaMode === "custom" && !customAreaLabel.trim()) {
      alert("Enter a custom area or utility PM label.");
      return;
    }

    const filledSteps = checklistSteps.filter((step) => step.label.trim());
    if (filledSteps.length === 0) {
      alert("Add at least one checklist step.");
      return;
    }

    setSaving(true);
    try {
      const payload: PmTemplateInput = {
        ...form,
        applies_to: "asset",
        estimated_minutes: null,
        checklist: rekeyChecklist(form.checklist),
        assignment: {
          ...form.assignment,
          area_id: areaMode === "area" ? form.assignment.area_id : null,
          asset_label:
            areaMode === "custom" ? customAreaLabel.trim() : null,
          end_date: noEndDate ? null : form.assignment.end_date,
        },
      };

      const url = editingId
        ? `/api/pm-templates/${editingId}`
        : "/api/pm-templates";
      const method = editingId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to save PM template");
      }

      onSaved();
      onClose();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to save PM template";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    color: "#C9C9C9",
    fontSize: "12px",
    fontWeight: 700,
    marginBottom: "6px",
  };

  const areaSelectValue =
    areaMode === "custom"
      ? PM_CUSTOM_AREA_VALUE
      : form.assignment.area_id
        ? String(form.assignment.area_id)
        : "";

  return (
    <div style={modalOverlay}>
      <div
        style={{
          ...modalBox,
          width: "min(760px, 96vw)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
        className="one-eyrie-modal"
      >
        <div style={modalHeader}>
          <h2 style={{ margin: 0 }}>
            {editingId
              ? "Edit PM Template"
              : isDuplicate
                ? "Duplicate PM Template"
                : "New PM Template"}
          </h2>
          <button type="button" style={closeButton} onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div style={formStack}>
          <div>
            <span style={labelStyle}>PM Template Name *</span>
            <input
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="Fire Extinguisher Monthly Inspection"
              style={input}
            />
          </div>

          <div>
            <span style={labelStyle}>Description</span>
            <textarea
              value={form.description || ""}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder="A brief summary of what this PM covers"
              maxLength={500}
              rows={3}
              style={{
                ...input,
                resize: "vertical",
                minHeight: "72px",
                fontFamily: "inherit",
              }}
            />
            <div
              style={{
                color: ONE_EYRIE.textSubtle,
                fontSize: "11px",
                marginTop: "4px",
              }}
            >
              500 characters max
            </div>
          </div>

          <div>
            <span style={labelStyle}>Area / Utility Area *</span>
            <select
              value={areaSelectValue}
              onChange={(e) => handleAreaSelection(e.target.value)}
              style={input}
            >
              <option value="">Select area…</option>
              {areaOptions.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
              <option value={PM_CUSTOM_AREA_VALUE}>
                Custom Area / Utility PM
              </option>
            </select>
            {areaMode === "custom" && (
              <input
                value={customAreaLabel}
                onChange={(e) => setCustomAreaLabel(e.target.value)}
                placeholder="Life Safety Program, Annual Compliance Walk…"
                style={{ ...input, marginTop: "8px" }}
              />
            )}
            <div
              style={{
                color: ONE_EYRIE.textSubtle,
                fontSize: "11px",
                marginTop: "6px",
                lineHeight: 1.45,
              }}
            >
              Use Hotel / Building / Main for property-wide PMs like fire
              extinguisher walks, exit signs, or hurricane readiness.
            </div>
          </div>

          <div>
            <span style={labelStyle}>Frequency *</span>
            <select
              value={form.frequency}
              onChange={(e) =>
                updateForm({
                  frequency: e.target.value as PmTemplateInput["frequency"],
                })
              }
              style={input}
            >
              {PM_FREQUENCIES.map((entry) => (
                <option key={entry} value={entry}>
                  {PM_FREQUENCY_LABELS[entry]}
                </option>
              ))}
            </select>
          </div>

          <div style={twoCol}>
            <div>
              <span style={labelStyle}>Start date *</span>
              <PmWorkloadDatePicker
                value={form.assignment.start_date}
                onChange={(start_date) => updateAssignment({ start_date })}
                schedules={schedules}
                editingTemplateId={editingId}
                draft={draftPm}
                inputStyle={input}
              />
            </div>

            <div>
              <span style={labelStyle}>End date</span>
              <input
                type="date"
                value={form.assignment.end_date || ""}
                onChange={(e) =>
                  updateAssignment({ end_date: e.target.value || null })
                }
                disabled={noEndDate}
                style={{
                  ...input,
                  opacity: noEndDate ? 0.5 : 1,
                }}
              />
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: ONE_EYRIE.text,
                  fontSize: "12px",
                  fontWeight: 600,
                  marginTop: "8px",
                }}
              >
                <input
                  type="checkbox"
                  checked={noEndDate}
                  onChange={(e) => {
                    setNoEndDate(e.target.checked);
                    if (e.target.checked) {
                      updateAssignment({ end_date: null });
                    }
                  }}
                />
                No end date
              </label>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: ONE_EYRIE.text,
              fontWeight: 700,
            }}
          >
            <input
              type="checkbox"
              checked={form.status === "Active"}
              onChange={(e) =>
                updateForm({ status: e.target.checked ? "Active" : "Inactive" })
              }
            />
            Active
          </label>

          <PmChecklistBuilder
            steps={checklistSteps}
            inputStyle={input}
            secondaryButton={secondaryButton}
            onChange={updateChecklistSteps}
          />
        </div>

        <div style={modalFooter}>
          <button
            type="button"
            style={secondaryButton}
            className="one-eyrie-btn one-eyrie-btn--neutral one-eyrie-btn--md"
            onClick={onClose}
            disabled={saving}
            {...neutralHoverHandlers(saving)}
          >
            Cancel
          </button>
          <button
            type="button"
            style={isDuplicate ? GOLD_OUTLINE_BUTTON : primaryButton}
            className={
              isDuplicate
                ? "one-eyrie-btn one-eyrie-btn--gold-outline one-eyrie-btn--lg"
                : "one-eyrie-btn one-eyrie-btn--gold-filled one-eyrie-btn--lg"
            }
            onClick={() => void handleSave()}
            disabled={saving}
            {...(isDuplicate
              ? goldHoverHandlers("secondary", saving)
              : goldFilledHoverHandlers(saving))}
          >
            {saving
              ? "Saving…"
              : editingId
                ? "Save Changes"
                : isDuplicate
                  ? "Create Duplicate"
                  : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

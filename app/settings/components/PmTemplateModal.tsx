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
  sortPmAreaOptions,
} from "@/app/maintenance/lib/pm-category";
import {
  PM_ASSIGNMENT_TYPE_LABELS,
  PM_ASSIGNMENT_TYPES,
  PM_CATEGORIES,
  PM_FREQUENCIES,
  PM_FREQUENCY_LABELS,
  PmCategory,
  PmAssignmentType,
  PmChecklistStep,
  PmAssignmentSchedule,
  PmTemplateInput,
} from "@/app/maintenance/lib/pm-types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
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
type UnitDraft = {
  clientKey: string;
  assignmentId?: number;
  name: string;
  areaId: number | null;
};

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
    category: "Custom",
    frequency: "monthly",
    assignment_type: "area_location",
    checklist: emptyChecklist(),
    status: "Active",
    assignment: {
      area_id: null,
      area_ids: [],
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
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
  const [customAreaLabel, setCustomAreaLabel] = useState("");
  const [units, setUnits] = useState<UnitDraft[]>([]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      if (initial) {
      const checklist = normalizeChecklist(initial.checklist || emptyChecklist());
      const initialAreaIds = Array.from(
        new Set(
          (
            initial.assignment?.area_ids?.length
              ? initial.assignment.area_ids
              : initial.assignment?.area_id
                ? [initial.assignment.area_id]
                : []
          ).filter((id): id is number => Number.isInteger(id) && id > 0)
        )
      );
      const hasCustomArea =
        Boolean(initial.assignment?.asset_label?.trim()) &&
        initialAreaIds.length === 0;

      setForm({
        name: initial.name || "",
        description: initial.description || "",
        category: initial.category || "Custom",
        frequency: initial.frequency || "monthly",
        assignment_type: initial.assignment_type || "area_location",
        units: initial.units || [],
        checklist,
        status: initial.status || "Active",
        assignment: {
          area_id: initialAreaIds[0] ?? null,
          area_ids: initialAreaIds,
          asset_label: initial.assignment?.asset_label ?? null,
          start_date: initial.assignment?.start_date || getLocalDateString(),
          end_date: initial.assignment?.end_date ?? null,
          status: initial.assignment?.status || "Active",
        },
      });
      setSelectedAreaIds(initialAreaIds);
      setUnits(
        (initial.units || []).map((unit, index) => ({
          clientKey: unit.assignment_id
            ? `assignment-${unit.assignment_id}`
            : `unit-${index + 1}`,
          assignmentId: unit.assignment_id,
          name:
            unit.name ||
            `${initial.name?.trim() || "Equipment"} #${index + 1}`,
          areaId: unit.area_id ?? null,
        }))
      );
      setAreaMode(hasCustomArea ? "custom" : "area");
      setCustomAreaLabel(
        hasCustomArea ? initial.assignment?.asset_label || "" : ""
      );
      setNoEndDate(!initial.assignment?.end_date);
        return;
      }

      setForm(emptyForm());
      setSelectedAreaIds([]);
      setUnits([]);
      setAreaMode("area");
      setCustomAreaLabel("");
      setNoEndDate(true);
    }, 0);

    return () => window.clearTimeout(timer);
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

  function toggleAreaSelection(areaId: number) {
    setAreaMode("area");
    setCustomAreaLabel("");
    setSelectedAreaIds((prev) => {
      const next = prev.includes(areaId)
        ? prev.filter((id) => id !== areaId)
        : [...prev, areaId];
      updateAssignment({
        area_id: next[0] ?? null,
        area_ids: next,
        asset_label: null,
      });
      return next;
    });
  }

  function selectCustomAreaMode() {
    setAreaMode("custom");
    setSelectedAreaIds([]);
    updateAssignment({
      area_id: null,
      area_ids: [],
    });
  }

  function changeAssignmentType(assignmentType: PmAssignmentType) {
    updateForm({ assignment_type: assignmentType });
    if (assignmentType === "equipment_unit" && units.length === 0) {
      setUnits([
        {
          clientKey: "unit-1",
          name: `${form.name.trim() || "Equipment"} #1`,
          areaId: null,
        },
      ]);
    }
  }

  function changeUnitCount(value: number) {
    const count = Math.max(1, Math.min(100, Math.trunc(value) || 1));
    setUnits((current) => {
      if (count <= current.length) return current.slice(0, count);
      return [
        ...current,
        ...Array.from({ length: count - current.length }, (_, index) => {
          const unitNumber = current.length + index + 1;
          return {
            clientKey: `unit-${Date.now()}-${unitNumber}`,
            name: `${form.name.trim() || "Equipment"} #${unitNumber}`,
            areaId: null,
          };
        }),
      ];
    });
  }

  function updateUnit(clientKey: string, patch: Partial<UnitDraft>) {
    setUnits((current) =>
      current.map((unit) =>
        unit.clientKey === clientKey ? { ...unit, ...patch } : unit
      )
    );
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert("PM template name is required.");
      return;
    }

    const assignmentType = form.assignment_type || "area_location";

    if (
      assignmentType === "area_location" &&
      areaMode === "area" &&
      selectedAreaIds.length === 0
    ) {
      alert("Select one or more areas, or choose Custom Area / Utility PM.");
      return;
    }

    if (
      assignmentType === "area_location" &&
      areaMode === "custom" &&
      !customAreaLabel.trim()
    ) {
      alert("Enter a custom area or utility PM label.");
      return;
    }

    if (
      assignmentType === "equipment_unit" &&
      (units.length === 0 || units.some((unit) => !unit.name.trim()))
    ) {
      alert("Add a name for each equipment unit.");
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
        assignment_type: assignmentType,
        units:
          assignmentType === "equipment_unit"
            ? units.map((unit) => ({
                assignment_id: unit.assignmentId,
                name: unit.name.trim(),
                area_id: unit.areaId,
              }))
            : undefined,
        applies_to: "asset",
        estimated_minutes: null,
        checklist: rekeyChecklist(form.checklist),
        assignment: {
          ...form.assignment,
          area_id:
            assignmentType === "equipment_unit"
              ? units[0]?.areaId ?? null
              : areaMode === "area"
                ? selectedAreaIds[0] ?? null
                : null,
          area_ids:
            assignmentType === "area_location" && areaMode === "area"
              ? selectedAreaIds
              : [],
          asset_label:
            assignmentType === "area_location" && areaMode === "custom"
              ? customAreaLabel.trim()
              : null,
          end_date: noEndDate ? null : form.assignment.end_date,
        },
      };

      const url = editingId
        ? `/api/pm-templates/${editingId}`
        : "/api/pm-templates";
      const method = editingId ? "PATCH" : "POST";

      const response = await tenantFetch(url, {
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
            <span style={labelStyle}>Assignment Type *</span>
            <select
              value={form.assignment_type || "area_location"}
              onChange={(event) =>
                changeAssignmentType(event.target.value as PmAssignmentType)
              }
              style={input}
            >
              {PM_ASSIGNMENT_TYPES.map((assignmentType) => (
                <option key={assignmentType} value={assignmentType}>
                  {PM_ASSIGNMENT_TYPE_LABELS[assignmentType]}
                </option>
              ))}
            </select>
          </div>

          {(form.assignment_type || "area_location") === "area_location" ? (
            <div>
              <span style={labelStyle}>Locations *</span>
              <div
                style={{
                  border: `1px solid ${ONE_EYRIE.border}`,
                  borderRadius: "10px",
                  background: ONE_EYRIE.surface,
                  maxHeight: "220px",
                  overflowY: "auto",
                  padding: "8px 10px",
                }}
              >
                {areaOptions.map((area) => {
                  const checked = selectedAreaIds.includes(area.id);
                  return (
                    <label
                      key={area.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "6px 4px",
                        color: ONE_EYRIE.text,
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAreaSelection(area.id)}
                      />
                      {area.name}
                    </label>
                  );
                })}
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: ONE_EYRIE.text,
                  fontSize: "13px",
                  fontWeight: 700,
                  marginTop: "10px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={areaMode === "custom"}
                  onChange={(event) => {
                    if (event.target.checked) {
                      selectCustomAreaMode();
                    } else {
                      setAreaMode("area");
                      updateAssignment({ asset_label: null });
                    }
                  }}
                />
                Custom Area / Utility PM
              </label>
              {areaMode === "custom" && (
                <input
                  value={customAreaLabel}
                  onChange={(event) => setCustomAreaLabel(event.target.value)}
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
                Select one or more property locations. This remains one PM
                template with independently completable locations.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ maxWidth: "180px", marginBottom: "12px" }}>
                <span style={labelStyle}>Number of Units *</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={units.length || 1}
                  onChange={(event) =>
                    changeUnitCount(Number(event.target.value))
                  }
                  style={input}
                />
              </div>
              <div style={{ display: "grid", gap: "10px" }}>
                {units.map((unit, index) => (
                  <div
                    key={unit.clientKey}
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "10px",
                      padding: "12px",
                      border: `1px solid ${ONE_EYRIE.border}`,
                      borderRadius: "10px",
                      background: ONE_EYRIE.surface,
                    }}
                  >
                    <label>
                      <span style={labelStyle}>Unit {index + 1} Name *</span>
                      <input
                        value={unit.name}
                        onChange={(event) =>
                          updateUnit(unit.clientKey, {
                            name: event.target.value,
                          })
                        }
                        style={input}
                      />
                    </label>
                    <label>
                      <span style={labelStyle}>Location</span>
                      <select
                        value={unit.areaId ? String(unit.areaId) : ""}
                        onChange={(event) =>
                          updateUnit(unit.clientKey, {
                            areaId: event.target.value
                              ? Number(event.target.value)
                              : null,
                          })
                        }
                        style={input}
                      >
                        <option value="">Unassigned</option>
                        {areaOptions.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
              <div
                style={{
                  color: ONE_EYRIE.textSubtle,
                  fontSize: "11px",
                  marginTop: "8px",
                  lineHeight: 1.45,
                }}
              >
                Each unit uses this template&apos;s checklist and keeps its own
                completion history, photos, failures, and work orders.
              </div>
            </div>
          )}

          <div style={twoCol}>
            <div>
              <span style={labelStyle}>Category *</span>
              <select
                value={form.category || "Custom"}
                onChange={(e) =>
                  updateForm({ category: e.target.value as PmCategory })
                }
                style={input}
              >
                {PM_CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
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

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
import { sortPmAreaOptions } from "@/app/maintenance/lib/pm-category";
import {
  PM_CATEGORIES,
  PM_FREQUENCIES,
  PM_FREQUENCY_LABELS,
  type PmAssignmentSchedule,
  type PmCategory,
  type PmChecklistStep,
  type PmItemInput,
  type PmTemplateInput,
} from "@/app/maintenance/lib/pm-types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { FLAT_RED, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import type { BuildingArea } from "../lib/buildings-types";
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

type ItemDraft = {
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

function emptyItem(index = 0, templateName = ""): ItemDraft {
  return {
    clientKey: `item-${Date.now()}-${index + 1}`,
    name: templateName.trim() ? `${templateName.trim()} #${index + 1}` : "",
    areaId: null,
  };
}

function emptyForm(): PmTemplateInput {
  return {
    name: "",
    description: "",
    category: "Custom",
    frequency: "monthly",
    assignment_type: "equipment_unit",
    named_locations: false,
    items: [],
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

function toDraftItems(
  source: PmItemInput[],
  templateName: string
): ItemDraft[] {
  if (source.length === 0) return [emptyItem(0, templateName)];
  return source.map((item, index) => ({
    clientKey: item.assignment_id
      ? `assignment-${item.assignment_id}`
      : `item-${index + 1}`,
    assignmentId: item.assignment_id,
    name: item.name || `${templateName || "Item"} #${index + 1}`,
    areaId: item.area_id ?? null,
  }));
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
  const [error, setError] = useState<string | null>(null);
  const [noEndDate, setNoEndDate] = useState(true);
  const [form, setForm] = useState<PmTemplateInput>(emptyForm());
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (!initial) {
        setForm(emptyForm());
        setItems([emptyItem()]);
        setNoEndDate(true);
        setError(null);
        return;
      }

      const sourceItems = initial.items || initial.units || [];
      setForm({
        ...emptyForm(),
        name: initial.name || "",
        description: initial.description || "",
        category: initial.category || "Custom",
        frequency: initial.frequency || "monthly",
        estimated_minutes: initial.estimated_minutes ?? null,
        assigned_role: initial.assigned_role || "Maintenance",
        assigned_member_id: initial.assigned_member_id || null,
        applies_to: initial.applies_to || "asset",
        checklist: normalizeChecklist(initial.checklist || emptyChecklist()),
        status: initial.status || "Active",
        assignment: {
          area_id: null,
          area_ids: [],
          asset_label: null,
          start_date: initial.assignment?.start_date || getLocalDateString(),
          end_date: initial.assignment?.end_date ?? null,
          status: initial.assignment?.status || "Active",
        },
      });
      setItems(toDraftItems(sourceItems, initial.name || ""));
      setNoEndDate(!initial.assignment?.end_date);
      setError(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, initial]);

  const areaOptions = useMemo(
    () => sortPmAreaOptions(areas),
    [areas]
  );
  const draftPm = useMemo(
    () => ({ name: form.name, frequency: form.frequency }),
    [form.name, form.frequency]
  );

  if (!open) return null;

  const checklistSteps = getFlatChecklistSteps(form.checklist);
  const labelStyle: React.CSSProperties = {
    display: "block",
    color: "#C9C9C9",
    fontSize: "12px",
    fontWeight: 700,
    marginBottom: "6px",
  };

  function updateForm(patch: Partial<PmTemplateInput>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function updateAssignment(patch: Partial<PmTemplateInput["assignment"]>) {
    setForm((current) => ({
      ...current,
      assignment: { ...current.assignment, ...patch },
    }));
  }

  function updateChecklistSteps(steps: PmChecklistStep[]) {
    updateForm({ checklist: stepsToChecklist(steps) });
  }

  function changeItemCount(value: number) {
    const count = Math.max(1, Math.min(100, Math.trunc(value) || 1));
    setItems((current) => {
      if (count <= current.length) return current.slice(0, count);
      return [
        ...current,
        ...Array.from({ length: count - current.length }, (_, offset) =>
          emptyItem(current.length + offset, form.name)
        ),
      ];
    });
  }

  function updateItem(clientKey: string, patch: Partial<ItemDraft>) {
    setItems((current) =>
      current.map((item) =>
        item.clientKey === clientKey ? { ...item, ...patch } : item
      )
    );
  }

  async function handleSave() {
    const filledSteps = checklistSteps.filter((step) => step.label.trim());
    if (!form.name.trim()) {
      setError("PM template name is required.");
      return;
    }
    if (items.length === 0 || items.some((item) => !item.name.trim())) {
      setError("Enter an Item Name for every PM item.");
      return;
    }
    if (filledSteps.length === 0) {
      setError("Add at least one checklist step.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: PmTemplateInput = {
        ...form,
        assignment_type: "equipment_unit",
        named_locations: false,
        items: items.map((item) => ({
          assignment_id: item.assignmentId,
          name: item.name.trim(),
          area_id: item.areaId,
        })),
        units: undefined,
        applies_to: "asset",
        estimated_minutes: null,
        checklist: rekeyChecklist(form.checklist),
        assignment: {
          ...form.assignment,
          area_id: null,
          area_ids: [],
          asset_label: null,
          status: form.status || "Active",
          end_date: noEndDate ? null : form.assignment.end_date,
        },
      };
      const response = await tenantFetch(
        editingId ? `/api/pm-templates/${editingId}` : "/api/pm-templates",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to save PM template");
      }
      onSaved();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save PM template"
      );
    } finally {
      setSaving(false);
    }
  }

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
              onChange={(event) => updateForm({ name: event.target.value })}
              placeholder="Commercial Dryer"
              style={input}
            />
          </div>

          <div>
            <span style={labelStyle}>Description</span>
            <textarea
              value={form.description || ""}
              onChange={(event) =>
                updateForm({ description: event.target.value })
              }
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
          </div>

          <div style={twoCol}>
            <div>
              <span style={labelStyle}>Category *</span>
              <select
                value={form.category || "Custom"}
                onChange={(event) =>
                  updateForm({ category: event.target.value as PmCategory })
                }
                style={input}
              >
                {PM_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span style={labelStyle}>Frequency *</span>
              <select
                value={form.frequency}
                onChange={(event) =>
                  updateForm({
                    frequency: event.target
                      .value as PmTemplateInput["frequency"],
                  })
                }
                style={input}
              >
                {PM_FREQUENCIES.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {PM_FREQUENCY_LABELS[frequency]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={twoCol}>
            <div>
              <span style={labelStyle}>Start Date *</span>
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
              <span style={labelStyle}>End Date</span>
              <input
                type="date"
                value={form.assignment.end_date || ""}
                onChange={(event) =>
                  updateAssignment({ end_date: event.target.value || null })
                }
                disabled={noEndDate}
                style={{ ...input, opacity: noEndDate ? 0.5 : 1 }}
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
                  onChange={(event) => {
                    setNoEndDate(event.target.checked);
                    if (event.target.checked) {
                      updateAssignment({ end_date: null });
                    }
                  }}
                />
                No end date
              </label>
            </div>
          </div>

          <section>
            <div style={{ maxWidth: "180px", marginBottom: "12px" }}>
              <span style={labelStyle}>Number of Items *</span>
              <input
                type="number"
                min={1}
                max={100}
                value={items.length}
                onChange={(event) =>
                  changeItemCount(Number(event.target.value))
                }
                style={input}
              />
            </div>
            <div style={{ display: "grid", gap: "10px" }}>
              {items.map((item, index) => (
                <div
                  key={item.clientKey}
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
                    <span style={labelStyle}>Item {index + 1} Name *</span>
                    <input
                      value={item.name}
                      onChange={(event) =>
                        updateItem(item.clientKey, {
                          name: event.target.value,
                        })
                      }
                      placeholder={`${form.name.trim() || "Item"} #${index + 1}`}
                      style={input}
                    />
                  </label>
                  <label>
                    <span style={labelStyle}>Location</span>
                    <select
                      value={item.areaId ? String(item.areaId) : ""}
                      onChange={(event) =>
                        updateItem(item.clientKey, {
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
                          {area.status === "Inactive" ? " (Inactive)" : ""}
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
              Each item uses this template&apos;s checklist and keeps its own
              result, history, failures, notes, photos, and work orders.
            </div>
          </section>

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
              onChange={(event) =>
                updateForm({
                  status: event.target.checked ? "Active" : "Inactive",
                })
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

          {error ? (
            <div
              style={{
                color: FLAT_RED.text,
                border: `1px solid ${FLAT_RED.border}`,
                borderRadius: "8px",
                padding: "10px 12px",
              }}
            >
              {error}
            </div>
          ) : null}
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

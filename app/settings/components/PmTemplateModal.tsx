"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  emptyChecklist,
  emptyChecklistCategory,
  emptyChecklistStep,
  normalizeChecklist,
  rekeyChecklist,
} from "@/app/maintenance/lib/pm-checklist-draft";
import {
  PM_ASSIGNED_ROLES,
  PM_CATEGORIES,
  PM_FREQUENCIES,
  PM_FREQUENCY_LABELS,
  PmChecklistCategory,
  PmTemplateInput,
} from "@/app/maintenance/lib/pm-types";
import { BuildingArea } from "../lib/buildings-types";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  forestHoverHandlers,
  secondaryHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "../lib/settings-ui-interactions";

type PmTemplateModalProps = {
  open: boolean;
  editingId: number | null;
  areas: BuildingArea[];
  initial?: Partial<PmTemplateInput> & { id?: number };
  styles: Record<string, React.CSSProperties>;
  onClose: () => void;
  onSaved: () => void;
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
    category: "Mechanical",
    frequency: "monthly",
    assigned_role: "Maintenance",
    applies_to: "asset",
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
  areas,
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

  useEffect(() => {
    if (!open) return;

    if (initial) {
      const checklist = normalizeChecklist(initial.checklist || emptyChecklist());
      setForm({
        name: initial.name || "",
        description: initial.description || "",
        category: initial.category || "Mechanical",
        frequency: initial.frequency || "monthly",
        assigned_role: initial.assigned_role || "Maintenance",
        assigned_member_id: initial.assigned_member_id || null,
        applies_to: initial.applies_to || "asset",
        checklist,
        status: initial.status || "Active",
        assignment: {
          area_id: initial.assignment?.area_id ?? null,
          asset_label: initial.assignment?.asset_label ?? null,
          start_date:
            initial.assignment?.start_date || getLocalDateString(),
          end_date: initial.assignment?.end_date ?? null,
          status: initial.assignment?.status || "Active",
        },
      });
      setNoEndDate(!initial.assignment?.end_date);
      return;
    }

    setForm(emptyForm());
    setNoEndDate(true);
  }, [open, initial]);

  const areaOptions = useMemo(
    () => areas.filter((area) => area.area_type !== "Guest Room"),
    [areas]
  );

  if (!open) return null;

  function updateForm(patch: Partial<PmTemplateInput>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function updateAssignment(
    patch: Partial<PmTemplateInput["assignment"]>
  ) {
    setForm((prev) => ({
      ...prev,
      assignment: { ...prev.assignment, ...patch },
    }));
  }

  function updateCategory(
    index: number,
    patch: Partial<PmChecklistCategory>
  ) {
    setForm((prev) => ({
      ...prev,
      checklist: {
        categories: prev.checklist.categories.map((category, categoryIndex) =>
          categoryIndex === index ? { ...category, ...patch } : category
        ),
      },
    }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert("Template name is required.");
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
          asset_label: null,
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

  return (
    <div style={modalOverlay}>
      <div
        style={{
          ...modalBox,
          width: "min(760px, 96vw)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div style={modalHeader}>
          <h2 style={{ margin: 0 }}>
            {editingId ? "Edit PM Template" : "New PM Template"}
          </h2>
          <button type="button" style={closeButton} onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div style={formStack}>
          <div>
            <span style={labelStyle}>Name *</span>
            <input
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="Elevator 1 Monthly PM"
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
            <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "11px", marginTop: "4px" }}>
              500 characters max
            </div>
          </div>

          <div style={twoCol}>
            <div>
              <span style={labelStyle}>Category *</span>
              <select
                value={form.category}
                onChange={(e) =>
                  updateForm({
                    category: e.target.value as PmTemplateInput["category"],
                  })
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
              <input
                type="date"
                value={form.assignment.start_date}
                onChange={(e) =>
                  updateAssignment({ start_date: e.target.value })
                }
                style={input}
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

          <div style={twoCol}>
            <div>
              <span style={labelStyle}>Assigned to</span>
              <select
                value={form.assigned_role || "Maintenance"}
                onChange={(e) => updateForm({ assigned_role: e.target.value })}
                style={input}
              >
                {PM_ASSIGNED_ROLES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span style={labelStyle}>Area</span>
              <select
                value={form.assignment.area_id ?? ""}
                onChange={(e) =>
                  updateAssignment({
                    area_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
                style={input}
              >
                <option value="">Select area…</option>
                {areaOptions.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <span style={{ ...labelStyle, marginBottom: 0 }}>Checklist</span>
              <button
                type="button"
                onClick={() =>
                  updateForm({
                    checklist: {
                      categories: [
                        ...form.checklist.categories,
                        emptyChecklistCategory(form.checklist.categories.length),
                      ],
                    },
                  })
                }
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
                Add category
              </button>
            </div>

            {form.checklist.categories.map((category, categoryIndex) => (
              <div
                key={`${category.key}-${categoryIndex}`}
                style={{
                  border: `1px solid ${ONE_EYRIE.border}`,
                  borderRadius: "10px",
                  padding: "12px",
                  marginBottom: "10px",
                  background: ONE_EYRIE.surfacePanel,
                }}
              >
                <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                  <input
                    value={category.name}
                    onChange={(e) =>
                      updateCategory(categoryIndex, { name: e.target.value })
                    }
                    placeholder="Category name"
                    style={{ ...input, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateForm({
                        checklist: {
                          categories: form.checklist.categories.filter(
                            (_, index) => index !== categoryIndex
                          ),
                        },
                      })
                    }
                    style={{
                      ...SETTINGS_BUTTON_BASE,
                      border: "none",
                      background: "transparent",
                      color: ONE_EYRIE.textMuted,
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {category.steps.map((step, stepIndex) => (
                  <div
                    key={`${step.key}-${stepIndex}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto auto",
                      gap: "8px",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <input
                      value={step.label}
                      onChange={(e) =>
                        updateForm({
                          checklist: {
                            categories: form.checklist.categories.map(
                              (entry, index) =>
                                index === categoryIndex
                                  ? {
                                      ...entry,
                                      steps: entry.steps.map((item, itemIndex) =>
                                        itemIndex === stepIndex
                                          ? { ...item, label: e.target.value }
                                          : item
                                      ),
                                    }
                                  : entry
                            ),
                          },
                        })
                      }
                      placeholder="Checklist step"
                      style={input}
                    />
                    <label
                      style={{
                        color: ONE_EYRIE.textSubtle,
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={step.required}
                        onChange={(e) =>
                          updateForm({
                            checklist: {
                              categories: form.checklist.categories.map(
                                (entry, index) =>
                                  index === categoryIndex
                                    ? {
                                        ...entry,
                                        steps: entry.steps.map(
                                          (item, itemIndex) =>
                                            itemIndex === stepIndex
                                              ? {
                                                  ...item,
                                                  required: e.target.checked,
                                                }
                                              : item
                                        ),
                                      }
                                    : entry
                              ),
                            },
                          })
                        }
                      />
                      Required
                    </label>
                    <label
                      style={{
                        color: ONE_EYRIE.textSubtle,
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={step.photoRequiredOnFail}
                        onChange={(e) =>
                          updateForm({
                            checklist: {
                              categories: form.checklist.categories.map(
                                (entry, index) =>
                                  index === categoryIndex
                                    ? {
                                        ...entry,
                                        steps: entry.steps.map(
                                          (item, itemIndex) =>
                                            itemIndex === stepIndex
                                              ? {
                                                  ...item,
                                                  photoRequiredOnFail:
                                                    e.target.checked,
                                                }
                                              : item
                                        ),
                                      }
                                    : entry
                              ),
                            },
                          })
                        }
                      />
                      Photo on fail
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateForm({
                          checklist: {
                            categories: form.checklist.categories.map(
                              (entry, index) =>
                                index === categoryIndex
                                  ? {
                                      ...entry,
                                      steps: entry.steps.filter(
                                        (_, itemIndex) => itemIndex !== stepIndex
                                      ),
                                    }
                                  : entry
                            ),
                          },
                        })
                      }
                      style={{
                        ...SETTINGS_BUTTON_BASE,
                        border: "none",
                        background: "transparent",
                        color: ONE_EYRIE.textMuted,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    updateForm({
                      checklist: {
                        categories: form.checklist.categories.map(
                          (entry, index) =>
                            index === categoryIndex
                              ? {
                                  ...entry,
                                  steps: [
                                    ...entry.steps,
                                    emptyChecklistStep(entry.steps.length),
                                  ],
                                }
                              : entry
                        ),
                      },
                    })
                  }
                  style={{
                    ...SETTINGS_BUTTON_BASE,
                    color: ONE_EYRIE.gold,
                    background: "transparent",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: 0,
                  }}
                >
                  + Add step
                </button>
              </div>
            ))}
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
        </div>

        <div style={modalFooter}>
          <button
            type="button"
            style={secondaryButton}
            onClick={onClose}
            disabled={saving}
            {...secondaryHoverHandlers()}
          >
            Cancel
          </button>
          <button
            type="button"
            style={primaryButton}
            onClick={() => void handleSave()}
            disabled={saving}
            {...forestHoverHandlers()}
          >
            {saving ? "Saving…" : editingId ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

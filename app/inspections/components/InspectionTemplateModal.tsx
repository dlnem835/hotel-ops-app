"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Languages,
  Printer,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import {
  CategoryDraft,
  contentToDraft,
  draftToContent,
  formatTemplateDate,
  getDraftCategoryName,
  getDraftLabel,
  ItemDraft,
  propertyTemplateToDraft,
  setDraftCategoryName,
  setDraftLabel,
  TemplateContentDraft,
} from "../lib/template-draft";
import { getStandardTemplate } from "../standards";
import {
  countContentItems,
  countContentPoints,
  standardToPropertyContent,
} from "../standards/builders";
import {
  PropertyInspectionTemplate,
  StandardTemplateDefinition,
  TEMPLATE_STATUSES,
  TEMPLATE_TYPES,
  TemplateLanguage,
} from "../standards/types";
import { GOLD } from "@/app/settings/lib/buildings-areas";
import {
  goldHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";

type InspectionTemplateModalProps = {
  open: boolean;
  mode: "property" | "standard-preview";
  propertyTemplate?: PropertyInspectionTemplate | null;
  standard?: StandardTemplateDefinition | null;
  styles: Record<string, React.CSSProperties>;
  onClose: () => void;
  onSaved?: (template: PropertyInspectionTemplate) => void;
  onRestored?: (template: PropertyInspectionTemplate) => void;
};

function emptyDraft(): TemplateContentDraft {
  return {
    name: "",
    template_type: "Guest Room",
    status: "Active",
    categories: [],
  };
}

export default function InspectionTemplateModal({
  open,
  mode,
  propertyTemplate,
  standard,
  styles,
  onClose,
  onSaved,
  onRestored,
}: InspectionTemplateModalProps) {
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
    iconButton,
  } = styles;

  const [language, setLanguage] = useState<TemplateLanguage>("en");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<TemplateContentDraft>(emptyDraft());
  const printRef = useRef<HTMLDivElement>(null);

  const readOnly = mode === "standard-preview";

  React.useEffect(() => {
    if (!open) return;

    if (mode === "property" && propertyTemplate) {
      setDraft(propertyTemplateToDraft(propertyTemplate));
    } else if (mode === "standard-preview" && standard) {
      setDraft(
        contentToDraft(
          standard.name,
          standard.templateType,
          "Active",
          standardToPropertyContent(standard)
        )
      );
    }

    setLanguage("en");
  }, [open, mode, propertyTemplate, standard]);

  const standardMeta = useMemo(() => {
    if (standard) return standard;
    if (propertyTemplate?.standard_key) {
      return getStandardTemplate(propertyTemplate.standard_key) ?? null;
    }
    return null;
  }, [standard, propertyTemplate]);

  const itemCount = useMemo(() => {
    const content = draftToContent(draft);
    return countContentItems(content);
  }, [draft]);

  const totalPoints = useMemo(() => {
    const content = draftToContent(draft);
    return countContentPoints(content);
  }, [draft]);

  if (!open) return null;

  function updateDraft(patch: Partial<TemplateContentDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function updateCategory(clientId: string, patch: Partial<CategoryDraft>) {
    setDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.clientId === clientId ? { ...cat, ...patch } : cat
      ),
    }));
  }

  function updateItem(
    categoryClientId: string,
    itemClientId: string,
    patch: Partial<ItemDraft>
  ) {
    setDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.clientId === categoryClientId
          ? {
              ...cat,
              items: cat.items.map((item) =>
                item.clientId === itemClientId ? { ...item, ...patch } : item
              ),
            }
          : cat
      ),
    }));
  }

  async function handleSave() {
    if (!propertyTemplate || readOnly) return;

    const content = draftToContent(draft);
    if (!draft.name.trim() || !content.categories.length) {
      alert("Template name and at least one category with items are required.");
      return;
    }

    setSaving(true);
    const response = await fetch(
      `/api/property-inspection-templates/${propertyTemplate.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          template_type: draft.template_type,
          status: draft.status,
          content,
        }),
      }
    );
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to save template");
      return;
    }

    onSaved?.(result.template);
    onClose();
  }

  async function handleRestoreStandard() {
    if (!propertyTemplate?.standard_key || readOnly) return;

    if (
      !confirm(
        "Restore this template to the current One Eyrie standard? Your property customizations will be replaced."
      )
    ) {
      return;
    }

    setSaving(true);
    const response = await fetch(
      `/api/property-inspection-templates/${propertyTemplate.id}/restore-standard`,
      { method: "POST" }
    );
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to restore standard");
      return;
    }

    onRestored?.(result.template);
    onClose();
  }

  function handlePrint() {
    window.print();
  }

  const buttonBase = SETTINGS_BUTTON_BASE;

  const toolbarButton: React.CSSProperties = {
    ...secondaryButton,
    ...buttonBase,
    height: "38px",
    fontSize: "13px",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  };

  return (
    <>
      <div style={modalOverlay} className="inspection-template-overlay">
        <div
          style={{
            ...modalBox,
            width: "960px",
            maxWidth: "95vw",
            maxHeight: "92vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
          className="inspection-template-modal"
        >
          <div style={modalHeader}>
            <div>
              <h2 style={{ margin: 0 }}>
                {readOnly ? `Standard: ${draft.name}` : draft.name || "Inspection Template"}
              </h2>
              <div
                style={{
                  color: "#9CA3AF",
                  fontSize: "12px",
                  marginTop: "6px",
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                {standardMeta && (
                  <span>Standard v{standardMeta.version}</span>
                )}
                {propertyTemplate && (
                  <>
                    <span>Property v{propertyTemplate.property_version}</span>
                    <span>
                      Last modified: {formatTemplateDate(propertyTemplate.last_modified_at)}
                    </span>
                  </>
                )}
                <span>
                  {itemCount} items · {totalPoints} points
                </span>
              </div>
            </div>
            <button
              type="button"
              style={{ ...closeButton, ...buttonBase }}
              onClick={onClose}
              {...goldHoverHandlers("icon")}
            >
              <X size={22} />
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              padding: "0 24px 12px",
              flexWrap: "wrap",
              borderBottom: "1px solid #3A352E",
            }}
            className="no-print"
          >
            {!readOnly && (
              <button
                type="button"
                style={toolbarButton}
                onClick={handleSave}
                disabled={saving}
                {...goldHoverHandlers("secondary", saving)}
              >
                <Save size={15} />
                Save
              </button>
            )}
            <button
              type="button"
              style={toolbarButton}
              onClick={handlePrint}
              {...goldHoverHandlers("secondary")}
            >
              <Printer size={15} />
              Print
            </button>
            <button
              type="button"
              style={{
                ...toolbarButton,
                borderColor: language === "es" ? GOLD : undefined,
                color: language === "es" ? GOLD : undefined,
              }}
              onClick={() => setLanguage((prev) => (prev === "en" ? "es" : "en"))}
              {...goldHoverHandlers("secondary")}
            >
              <Languages size={15} />
              {language === "en" ? "Spanish" : "English"}
            </button>
            {!readOnly && propertyTemplate?.standard_key && (
              <button
                type="button"
                style={toolbarButton}
                onClick={handleRestoreStandard}
                disabled={saving}
                {...goldHoverHandlers("secondary", saving)}
              >
                <RotateCcw size={15} />
                Restore Standard
              </button>
            )}
          </div>

          <div
            ref={printRef}
            style={{
              ...formStack,
              overflowY: "auto",
              flex: 1,
              paddingRight: "4px",
            }}
            className="inspection-template-print-area"
          >
            {readOnly && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #3A352E",
                  color: "#C9C9C9",
                  fontSize: "13px",
                }}
              >
                Built-in One Eyrie standard — read only. Activate to create an
                editable property copy.
              </div>
            )}

            <div style={twoCol} className="no-print">
              <input
                value={draft.name}
                onChange={(e) => updateDraft({ name: e.target.value })}
                placeholder="Template Name"
                style={input}
                readOnly={readOnly}
              />
              <select
                value={draft.template_type}
                onChange={(e) =>
                  updateDraft({
                    template_type: e.target.value as TemplateContentDraft["template_type"],
                  })
                }
                style={input}
                disabled={readOnly || Boolean(propertyTemplate?.standard_key)}
              >
                {TEMPLATE_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>

            {!readOnly && (
              <select
                value={draft.status}
                onChange={(e) =>
                  updateDraft({
                    status: e.target.value as TemplateContentDraft["status"],
                  })
                }
                style={input}
                className="no-print"
              >
                {TEMPLATE_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            )}

            <div
              style={{ color: GOLD, fontWeight: 800, fontSize: "14px" }}
              className="print-template-title"
            >
              {draft.name} {language === "es" ? "(Español)" : ""}
            </div>

            {draft.categories.map((category) => (
              <div
                key={category.clientId}
                style={{
                  border: "1px solid #3A352E",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "#211F1B",
                }}
              >
                <input
                  value={getDraftCategoryName(category, language)}
                  onChange={(e) =>
                    updateCategory(
                      category.clientId,
                      setDraftCategoryName(category, language, e.target.value)
                    )
                  }
                  placeholder="Category name"
                  style={{ ...input, marginBottom: "12px", fontWeight: 700 }}
                  readOnly={readOnly}
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 80px",
                    gap: "8px",
                    color: "#9CA3AF",
                    fontSize: "11px",
                    fontWeight: 700,
                    marginBottom: "8px",
                    padding: "0 4px",
                  }}
                >
                  <div>{language === "es" ? "Pregunta" : "Item / Question"}</div>
                  <div>{language === "es" ? "Puntos" : "Points"}</div>
                  <div>{language === "es" ? "Requerido" : "Required"}</div>
                </div>

                {category.items.map((item) => (
                  <div
                    key={item.clientId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 80px",
                      gap: "8px",
                      marginBottom: "8px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      value={getDraftLabel(item, language)}
                      onChange={(e) =>
                        updateItem(
                          category.clientId,
                          item.clientId,
                          setDraftLabel(item, language, e.target.value)
                        )
                      }
                      style={input}
                      readOnly={readOnly}
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.pointValue}
                      onChange={(e) =>
                        updateItem(category.clientId, item.clientId, {
                          pointValue: Number(e.target.value),
                        })
                      }
                      style={input}
                      readOnly={readOnly}
                    />
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={(e) =>
                          updateItem(category.clientId, item.clientId, {
                            required: e.target.checked,
                          })
                        }
                        disabled={readOnly}
                      />
                    </label>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={modalFooter} className="no-print">
            <button
              type="button"
              style={{ ...secondaryButton, ...buttonBase }}
              onClick={onClose}
              {...goldHoverHandlers("secondary")}
            >
              Close
            </button>
            {!readOnly && (
              <button
                type="button"
                style={{ ...primaryButton, ...buttonBase }}
                onClick={handleSave}
                disabled={saving}
                {...goldHoverHandlers("primary", saving)}
              >
                {saving ? "Saving..." : "Save Template"}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .inspection-template-print-area,
          .inspection-template-print-area * {
            visibility: visible;
          }
          .inspection-template-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 24px !important;
          }
          .inspection-template-print-area input {
            border: none !important;
            background: transparent !important;
            color: black !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .inspection-template-overlay {
            position: static !important;
            background: white !important;
          }
          .inspection-template-modal {
            box-shadow: none !important;
            border: none !important;
            max-height: none !important;
            width: 100% !important;
          }
        }
      `}</style>
    </>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { FOREST, NEUTRAL_PILL, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import InspectionTemplateModal from "@/app/inspections/components/InspectionTemplateModal";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { countContentItems } from "@/app/inspections/standards/builders";
import { formatTemplateDate } from "@/app/inspections/lib/template-draft";
import {
  getStandardTemplate,
  STANDARD_INSPECTION_LIBRARY_META,
  STANDARD_TEMPLATE_LIBRARY,
} from "@/app/inspections/standards";
import {
  PropertyInspectionTemplate,
  StandardTemplateSummary,
} from "@/app/inspections/standards/types";
import {
  forestHoverHandlers,
  goldHoverHandlers,
  secondaryHoverHandlers,
  SETTINGS_BUTTON_BASE,
  SETTINGS_CARD_TRANSITION,
  settingsCardHoverHandlers,
} from "../lib/settings-ui-interactions";

type ActivationInfo = {
  key: string;
  activated: boolean;
  standardVersion: string;
  propertyTemplate: PropertyInspectionTemplate | null;
  updateAvailable: boolean;
};

type InspectionTemplatesSectionProps = {
  styles: Record<string, React.CSSProperties>;
};

export default function InspectionTemplatesSection({
  styles,
}: InspectionTemplatesSectionProps) {
  const {
    sectionPanel,
    sectionToolbar,
    searchWrap,
    searchInput,
    primaryButton,
    secondaryButton,
    tableHeader,
    tableRow,
    rowTitle,
    rowText,
    statusPill,
    actionCell,
    iconButton,
    emptyState,
    modalOverlay,
    modalBox,
    modalHeader,
    closeButton,
    formStack,
    twoCol,
    input,
    modalFooter,
  } = styles;

  const [standards, setStandards] = useState<StandardTemplateSummary[]>([]);
  const [templates, setTemplates] = useState<PropertyInspectionTemplate[]>([]);
  const [activation, setActivation] = useState<ActivationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"property" | "standard-preview">(
    "property"
  );
  const [activeProperty, setActiveProperty] =
    useState<PropertyInspectionTemplate | null>(null);
  const [previewStandardKey, setPreviewStandardKey] = useState<string | null>(
    null
  );

  async function fetchData() {
    setLoading(true);
    const response = await tenantFetch("/api/property-inspection-templates");
    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      console.error(result.error);
      setStandards(STANDARD_TEMPLATE_LIBRARY.map((s) => ({
        key: s.key,
        version: s.version,
        name: s.name,
        templateType: s.templateType,
        description: s.description,
        categoryCount: s.categories.length,
        itemCount: s.categories.reduce((n, c) => n + c.items.length, 0),
        totalPoints: 0,
      })));
      setTemplates([]);
      setActivation([]);
      return;
    }

    setStandards(result.standards || []);
    setTemplates(result.templates || []);
    setActivation(result.activation || []);
  }

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activationMap = useMemo(() => {
    return new Map(activation.map((entry) => [entry.key, entry]));
  }, [activation]);

  const filteredPropertyTemplates = useMemo(() => {
    if (!search.trim()) return templates;
    const term = search.toLowerCase();
    return templates.filter((t) =>
      `${t.name} ${t.template_type} ${t.status} ${t.standard_key || ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [templates, search]);

  async function activateStandard(standardKey: string) {
    setSaving(true);
    const response = await tenantFetch("/api/property-inspection-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "activate", standardKey }),
    });
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to activate template");
      return;
    }

    await fetchData();
    setToast("Property template activated. You can edit your copy anytime.");
  }

  async function restoreStandard(id: number) {
    if (
      !confirm(
        "Update this property template to the current One Eyrie standard from SpringHill Suites? Your customizations will be replaced."
      )
    ) {
      return;
    }

    setSaving(true);
    const response = await tenantFetch(
      `/api/property-inspection-templates/${id}/restore-standard`,
      { method: "POST" }
    );
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to restore standard");
      return;
    }

    await fetchData();
    setToast("Template updated to the current One Eyrie standard.");
  }

  async function duplicateTemplate(id: number) {
    setSaving(true);
    const response = await tenantFetch(`/api/property-inspection-templates/${id}`, {
      method: "POST",
    });
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to duplicate template");
      return;
    }

    await fetchData();
    setToast("Template duplicated.");
  }

  async function deleteTemplate(id: number) {
    if (!confirm("Delete this property template?")) return;

    setSaving(true);
    const response = await tenantFetch(`/api/property-inspection-templates/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to delete template");
      return;
    }

    await fetchData();
    setToast("Template deleted.");
  }

  async function setTemplateStatus(id: number, status: "Active" | "Inactive") {
    setSaving(true);
    const response = await tenantFetch(`/api/property-inspection-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", status }),
    });
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to update status");
      return;
    }

    await fetchData();
    setToast(status === "Inactive" ? "Template deactivated." : "Template activated.");
  }

  function openPropertyEdit(template: PropertyInspectionTemplate) {
    setActiveProperty(template);
    setPreviewStandardKey(null);
    setModalMode("property");
    setModalOpen(true);
  }

  function openStandardPreview(standardKey: string) {
    setActiveProperty(null);
    setPreviewStandardKey(standardKey);
    setModalMode("standard-preview");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setActiveProperty(null);
    setPreviewStandardKey(null);
  }

  function renderStatusPill(status: string) {
    const isActive = status === "Active";
    return (
      <span
        style={{
          ...statusPill,
          borderColor: isActive ? FOREST.border : NEUTRAL_PILL.border,
          color: isActive ? FOREST.text : NEUTRAL_PILL.text,
        }}
      >
        {status}
      </span>
    );
  }

  const buttonBase = SETTINGS_BUTTON_BASE;
  const tableGrid = "1.3fr 0.9fr 0.7fr 0.7fr 1fr 1.1fr";
  const standardCardBase = {
    border: `1px solid ${ONE_EYRIE.border}`,
    borderRadius: "14px",
    padding: "18px",
    background: ONE_EYRIE.surface,
    transition: SETTINGS_CARD_TRANSITION,
  } as const;

  return (
    <div style={sectionPanel}>
      {toast && (
        <div
          style={{
            marginBottom: "14px",
            padding: "12px 14px",
            borderRadius: "10px",
            border: `1px solid ${ONE_EYRIE.gold}`,
            color: ONE_EYRIE.gold,
            fontWeight: 700,
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          border: `1px solid ${ONE_EYRIE.gold}`,
          borderRadius: "16px",
          padding: "24px",
          background: ONE_EYRIE.surfacePanel,
          marginBottom: "18px",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "18px" }}>
            One Eyrie Standard Library
          </div>
          <p style={{ color: ONE_EYRIE.textMuted, margin: "8px 0 0", lineHeight: 1.6 }}>
            Room and RPM masters are locked from{" "}
            {STANDARD_INSPECTION_LIBRARY_META.sourcePropertyName}. They cannot be
            edited here. Activate a template to create your property copy; new
            inspections across desktop and mobile use that Active copy.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "14px",
          }}
        >
          {standards.map((standard) => {
            const state = activationMap.get(standard.key);
            const activated = state?.activated ?? false;
            const updateAvailable = state?.updateAvailable ?? false;
            const propertyTemplateId = state?.propertyTemplate?.id ?? null;

            return (
              <div
                key={standard.key}
                style={standardCardBase}
                {...settingsCardHoverHandlers()}
              >
                <div style={{ color: ONE_EYRIE.text, fontWeight: 800 }}>{standard.name}</div>
                <div style={{ color: ONE_EYRIE.gold, fontSize: "12px", marginTop: "4px" }}>
                  {standard.templateType} · Standard v{standard.version}
                  {updateAvailable ? " · Update available" : ""}
                </div>
                <div
                  style={{
                    color: ONE_EYRIE.textMuted,
                    fontSize: "13px",
                    marginTop: "10px",
                    lineHeight: 1.5,
                  }}
                >
                  {standard.description}
                </div>
                <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "8px" }}>
                  {standard.categoryCount} categories · {standard.itemCount} items
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                  <button
                    type="button"
                    style={{
                      ...secondaryButton,
                      ...buttonBase,
                      flex: 1,
                      height: "38px",
                      fontSize: "13px",
                    }}
                    onClick={() => openStandardPreview(standard.key)}
                    {...secondaryHoverHandlers()}
                  >
                    <Eye size={14} />
                    Preview
                  </button>
                  {updateAvailable && propertyTemplateId != null ? (
                    <button
                      type="button"
                      style={{
                        ...primaryButton,
                        ...buttonBase,
                        flex: 1,
                        height: "38px",
                        fontSize: "13px",
                      }}
                      onClick={() => restoreStandard(propertyTemplateId)}
                      disabled={saving}
                      {...forestHoverHandlers(saving)}
                    >
                      <RotateCcw size={14} />
                      Update
                    </button>
                  ) : activated ? (
                    <span
                      style={{
                        ...statusPill,
                        alignSelf: "center",
                        borderColor: FOREST.border,
                        color: FOREST.text,
                      }}
                    >
                      Activated
                    </span>
                  ) : (
                    <button
                      type="button"
                      style={{
                        ...primaryButton,
                        ...buttonBase,
                        flex: 1,
                        height: "38px",
                        fontSize: "13px",
                      }}
                      onClick={() => activateStandard(standard.key)}
                      disabled={saving}
                      {...forestHoverHandlers(saving)}
                    >
                      <Sparkles size={14} />
                      Activate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...sectionToolbar, flexWrap: "wrap" }}>
        <div style={searchWrap}>
          <Search
            size={18}
            color="#E5E7EB"
            style={{ position: "absolute", left: 16, top: 14 }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search property templates..."
            style={searchInput}
          />
        </div>
      </div>

      <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px", marginBottom: "12px" }}>
        Property Templates
      </div>

      <div
        className="one-eyrie-settings-data-grid one-eyrie-settings-data-grid--templates"
        style={{ ...tableHeader, gridTemplateColumns: undefined }}
      >
        <div>Template</div>
        <div>Type</div>
        <div>Items</div>
        <div>Status</div>
        <div>Version</div>
        <div style={{ textAlign: "right" }}>Actions</div>
      </div>

      {loading ? (
        <div style={emptyState}>Loading templates...</div>
      ) : filteredPropertyTemplates.length === 0 ? (
        <div style={emptyState}>
          No property templates yet. Activate a standard template above.
        </div>
      ) : (
        filteredPropertyTemplates.map((template) => {
          const currentStandardVersion =
            getStandardTemplate(template.standard_key || "")?.version || null;
          const basedVersion = template.based_on_standard_version || "—";
          const updateAvailable =
            Boolean(template.standard_key) &&
            Boolean(currentStandardVersion) &&
            basedVersion !== currentStandardVersion;

          return (
            <div
              key={template.id}
              className="one-eyrie-settings-data-grid one-eyrie-settings-data-grid--templates"
              style={{ ...tableRow, gridTemplateColumns: undefined }}
            >
              <div>
                <div style={rowTitle}>{template.name}</div>
                <div style={{ color: ONE_EYRIE.textMuted, fontSize: "12px", marginTop: "3px" }}>
                  {template.standard_key ? "Based on standard" : "Custom copy"} ·
                  Modified {formatTemplateDate(template.last_modified_at)}
                </div>
              </div>
              <div style={rowText}>{template.template_type}</div>
              <div style={rowText}>{countContentItems(template.content)}</div>
              <div>{renderStatusPill(template.status)}</div>
              <div style={{ ...rowText, fontSize: "12px", lineHeight: 1.5 }}>
                Std v{basedVersion}
                {currentStandardVersion ? ` → v${currentStandardVersion}` : ""}
                <br />
                Prop v{template.property_version}
                {updateAvailable ? (
                  <>
                    <br />
                    <span style={{ color: ONE_EYRIE.gold, fontWeight: 700 }}>
                      Update available
                    </span>
                  </>
                ) : null}
              </div>
              <div style={actionCell}>
                <button
                  type="button"
                  style={{ ...iconButton, ...buttonBase }}
                  onClick={() => openPropertyEdit(template)}
                  title="Edit"
                  {...goldHoverHandlers("icon")}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  style={{ ...iconButton, ...buttonBase }}
                  onClick={() => duplicateTemplate(template.id)}
                  title="Duplicate"
                  {...goldHoverHandlers("icon")}
                >
                  <Copy size={15} />
                </button>
                <button
                  type="button"
                  style={{ ...iconButton, ...buttonBase }}
                  onClick={() => openPropertyEdit(template)}
                  title="Print"
                  {...goldHoverHandlers("icon")}
                >
                  <Printer size={15} />
                </button>
                {template.standard_key && (
                  <button
                    type="button"
                    style={{ ...iconButton, ...buttonBase }}
                    onClick={() => restoreStandard(template.id)}
                    title="Restore Standard"
                    {...goldHoverHandlers("icon")}
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
                {template.status === "Active" ? (
                  <button
                    type="button"
                    style={{ ...iconButton, ...buttonBase }}
                    onClick={() => setTemplateStatus(template.id, "Inactive")}
                    title="Deactivate"
                    {...goldHoverHandlers("icon")}
                  >
                    <Ban size={15} />
                  </button>
                ) : (
                  <button
                    type="button"
                    style={{ ...iconButton, ...buttonBase }}
                    onClick={() => setTemplateStatus(template.id, "Active")}
                    title="Activate"
                    {...goldHoverHandlers("icon")}
                  >
                    <CheckCircle2 size={15} />
                  </button>
                )}
                <button
                  type="button"
                  style={{ ...iconButton, ...buttonBase }}
                  onClick={() => deleteTemplate(template.id)}
                  title="Delete"
                  {...goldHoverHandlers("icon")}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })
      )}

      <InspectionTemplateModal
        open={modalOpen}
        mode={modalMode}
        propertyTemplate={activeProperty}
        standard={
          previewStandardKey
            ? getStandardTemplate(previewStandardKey) ?? null
            : null
        }
        styles={{
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
        }}
        onClose={closeModal}
        onSaved={async () => {
          await fetchData();
          setToast("Property template saved.");
        }}
        onRestored={async () => {
          await fetchData();
          setToast("Template restored to standard.");
        }}
      />
    </div>
  );
}

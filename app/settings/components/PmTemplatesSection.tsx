"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Copy, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  formatDueStatusLabel,
  formatNextDueLabel,
} from "@/app/maintenance/lib/schedule-engine";
import {
  AreaPmGridSummary,
  PM_FREQUENCIES,
  PM_FREQUENCY_LABELS,
  PmAssignmentSchedule,
  PmFrequency,
  PmTemplate,
  PmTemplateInput,
} from "@/app/maintenance/lib/pm-types";
import { normalizeChecklist } from "@/app/maintenance/lib/pm-checklist-draft";
import {
  buildDuplicatePmTemplateInput,
  toPmTemplateWithAssignment,
} from "@/app/maintenance/lib/pm-template-duplicate";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  forestHoverHandlers,
  secondaryHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "../lib/settings-ui-interactions";
import { BuildingArea } from "../lib/buildings-types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import PmAssignmentGrid, { PmGridLegend } from "./PmAssignmentGrid";
import PmTemplateModal from "./PmTemplateModal";
import {
  useOrganizationContext,
  usePropertyContext,
} from "@/app/components/TenantContextProviders";
import { canManageStandardPmTemplates } from "@/app/maintenance/lib/standard-pm-access";

type PmTemplatesSectionProps = {
  styles: Record<string, React.CSSProperties>;
};

type PmScheduleGroup = {
  templateId: number;
  templateName: string;
  standardKey: string | null;
  frequency: PmFrequency;
  schedules: PmAssignmentSchedule[];
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function areaLabel(schedule: PmAssignmentSchedule): string {
  if (schedule.assetLabel && schedule.areaName) {
    return `${schedule.assetLabel} — ${schedule.areaName}`;
  }
  return schedule.assetLabel || schedule.areaName || "Unassigned item";
}

function formatScheduleDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dueStatusStyles(dueStatus: PmAssignmentSchedule["dueStatus"]) {
  switch (dueStatus) {
    case "overdue":
      return {
        background: "rgba(139, 82, 82, 0.35)",
        color: "#E57373",
      };
    case "due_soon":
      return {
        background: "rgba(200, 169, 106, 0.18)",
        color: "#E0C47B",
      };
    case "inactive":
      return {
        background: "rgba(90, 90, 90, 0.25)",
        color: "#9CA3AF",
      };
    default:
      return {
        background: "rgba(61, 107, 79, 0.18)",
        color: "#B8D4C4",
      };
  }
}

function groupDueStatus(
  schedules: PmAssignmentSchedule[]
): PmAssignmentSchedule["dueStatus"] {
  if (schedules.some((schedule) => schedule.dueStatus === "overdue")) {
    return "overdue";
  }
  if (schedules.some((schedule) => schedule.dueStatus === "due_soon")) {
    return "due_soon";
  }
  if (schedules.some((schedule) => schedule.dueStatus === "current")) {
    return "current";
  }
  return "inactive";
}

export default function PmTemplatesSection({ styles }: PmTemplatesSectionProps) {
  const { organization } = useOrganizationContext();
  const { activeProperty } = usePropertyContext();
  const canManageStandardPms = canManageStandardPmTemplates(
    organization && activeProperty
      ? { organization, activeProperty, properties: [] }
      : null
  );
  const {
    sectionPanel,
    sectionToolbar,
    searchWrap,
    searchInput,
    primaryButton,
    secondaryButton,
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

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [schedules, setSchedules] = useState<PmAssignmentSchedule[]>([]);
  const [templates, setTemplates] = useState<PmTemplate[]>([]);
  const [gridSummaries, setGridSummaries] = useState<AreaPmGridSummary[]>([]);
  const [areas, setAreas] = useState<BuildingArea[]>([]);
  const [expandedFrequencies, setExpandedFrequencies] = useState<
    Set<PmFrequency>
  >(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editInitial, setEditInitial] = useState<
    (Partial<PmTemplateInput> & { id?: number }) | undefined
  >(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [standardModalOpen, setStandardModalOpen] = useState(false);
  const [addingStandards, setAddingStandards] = useState(false);
  const [availableStandardCount, setAvailableStandardCount] = useState(0);
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pmRes, areasRes, standardRes] = await Promise.all([
        tenantFetch("/api/pm-templates"),
        tenantFetch("/api/buildings-areas"),
        canManageStandardPms
          ? tenantFetch("/api/pm-templates/standard")
          : Promise.resolve(null),
      ]);

      const pmData = await pmRes.json();
      const areasData = await areasRes.json();
      const standardData = standardRes ? await standardRes.json() : null;

      if (!pmRes.ok) {
        throw new Error(pmData.error || "Unable to load PM templates");
      }

      setSchedules(pmData.schedules || []);
      setTemplates(pmData.templates || []);
      setGridSummaries(pmData.gridSummaries || []);
      setAreas(areasData.areas || areasData || []);
      setAvailableStandardCount(
        standardRes?.ok ? standardData?.available?.length || 0 : 0
      );
    } catch (error: unknown) {
      console.error(error);
      setToast(
        error instanceof Error ? error.message : "Unable to load PM templates"
      );
    } finally {
      setLoading(false);
    }
  }, [canManageStandardPms]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchData]);

  const filteredScheduleGroups = useMemo(() => {
    const grouped = new Map<number, PmScheduleGroup>();
    for (const schedule of schedules) {
      if (showInactiveOnly && schedule.templateStatus !== "Inactive") {
        continue;
      }
      const existing = grouped.get(schedule.templateId);
      if (existing) {
        existing.schedules.push(schedule);
      } else {
        grouped.set(schedule.templateId, {
          templateId: schedule.templateId,
          templateName: schedule.templateName,
          standardKey: schedule.standardKey,
          frequency: schedule.frequency,
          schedules: [schedule],
        });
      }
    }

    const groups = Array.from(grouped.values());
    if (!search.trim()) return groups;
    const term = search.trim().toLowerCase();
    return groups.filter((group) =>
      [
        group.templateName,
        PM_FREQUENCY_LABELS[group.frequency],
        ...group.schedules.flatMap((schedule) => [
          schedule.areaName,
          schedule.assetLabel,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [schedules, search, showInactiveOnly]);

  const schedulesByFrequency = useMemo(() => {
    const grouped = new Map<PmFrequency, PmScheduleGroup[]>();
    for (const frequency of PM_FREQUENCIES) {
      grouped.set(frequency, []);
    }
    for (const group of filteredScheduleGroups) {
      grouped.get(group.frequency)?.push(group);
    }
    return grouped;
  }, [filteredScheduleGroups]);

  function toggleFrequency(frequency: PmFrequency) {
    setExpandedFrequencies((current) => {
      const next = new Set(current);
      if (next.has(frequency)) next.delete(frequency);
      else next.add(frequency);
      return next;
    });
  }

  function openNew() {
    setEditingId(null);
    setIsDuplicate(false);
    setEditInitial(undefined);
    setModalOpen(true);
  }

  function openNewForArea(areaId: number) {
    setEditingId(null);
    setIsDuplicate(false);
    setEditInitial({
      assignment: {
        area_id: areaId,
        area_ids: [areaId],
        asset_label: null,
        start_date: getLocalDateString(),
      },
    });
    setModalOpen(true);
  }

  async function openEdit(templateId: number) {
    try {
      const response = await tenantFetch(`/api/pm-templates/${templateId}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to load template");
      }

      const assignments = (result.assignments || []) as Array<{
        id: number;
        area_id: number | null;
        asset_label: string | null;
        start_date: string;
        end_date: string | null;
        status: "Active" | "Inactive";
      }>;
      const activeAssignments = assignments
        .filter((assignment) => assignment.status === "Active")
        .sort((a, b) => a.id - b.id);
      const selectedAssignments =
        activeAssignments.length > 0 ? activeAssignments : assignments;
      const primaryAssignment = selectedAssignments[0] || null;

      setEditingId(templateId);
      setIsDuplicate(false);
      setEditInitial({
        id: templateId,
        name: result.template.name,
        description: result.template.description,
        category: result.template.category,
        frequency: result.template.frequency,
        items: selectedAssignments.map((assignment, index) => ({
          assignment_id: assignment.id,
          name:
            assignment.asset_label ||
            areas.find((area) => area.id === assignment.area_id)?.name ||
            (selectedAssignments.length === 1
              ? result.template.name
              : `${result.template.name} #${index + 1}`),
          area_id: assignment.area_id,
        })),
        checklist: normalizeChecklist(result.template.checklist),
        status: result.template.status,
        assignment: primaryAssignment
          ? {
              area_id:
                selectedAssignments.find((assignment) => assignment.area_id)
                  ?.area_id ?? null,
              area_ids: activeAssignments
                .map((assignment) => assignment.area_id)
                .filter((areaId): areaId is number => areaId !== null),
              asset_label:
                selectedAssignments.find((assignment) => assignment.asset_label)
                  ?.asset_label ?? null,
              start_date: primaryAssignment.start_date,
              end_date: primaryAssignment.end_date,
              status: primaryAssignment.status,
            }
          : undefined,
      });
      setModalOpen(true);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Unable to load template");
    }
  }

  async function openDuplicate(templateId: number) {
    try {
      const response = await tenantFetch(`/api/pm-templates/${templateId}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to load template");
      }

      setEditingId(null);
      setIsDuplicate(true);
      const activeAssignments = (
        (result.assignments || []) as Array<{
          id: number;
          area_id: number | null;
          asset_label: string | null;
          status: string;
        }>
      )
        .filter((assignment) => assignment.status === "Active")
        .sort((a, b) => a.id - b.id);
      const duplicate = buildDuplicatePmTemplateInput(
        toPmTemplateWithAssignment(result)
      );
      duplicate.items = activeAssignments.map((assignment, index) => ({
        name:
          assignment.asset_label ||
          areas.find((area) => area.id === assignment.area_id)?.name ||
          (activeAssignments.length === 1
            ? result.template.name
            : `${result.template.name} #${index + 1}`),
        area_id: assignment.area_id,
      }));
      if (duplicate.assignment) {
        duplicate.assignment.area_id = null;
        duplicate.assignment.area_ids = [];
        duplicate.assignment.asset_label = null;
      }
      setEditInitial(duplicate);
      setModalOpen(true);
    } catch (error: unknown) {
      alert(
        error instanceof Error ? error.message : "Unable to duplicate template"
      );
    }
  }

  async function addStandardPms() {
    setAddingStandards(true);
    try {
      const response = await tenantFetch("/api/pm-templates/standard", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to add standard PMs");
      }

      await fetchData();
      setStandardModalOpen(false);
      const messages: string[] = [];
      if (result.created > 0) {
        messages.push(
          `Added ${result.created} standard PM template${
            result.created === 1 ? "" : "s"
          }: ${result.addedNames.join(", ")}.`
        );
      }
      if (result.adoptedNames?.length > 0) {
        messages.push(
          `Recognized ${result.adoptedNames.length} existing PM template${
            result.adoptedNames.length === 1 ? "" : "s"
          } as installed standards.`
        );
      }
      setToast(
        messages.join(" ") ||
          "All standard PM templates are already added to this property."
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to add standard PMs";
      setToast(`Error: ${message}`);
    } finally {
      setAddingStandards(false);
    }
  }

  async function deleteTemplate(templateId: number) {
    if (
      !confirm("Delete this PM template? This action cannot be undone.")
    ) {
      return;
    }

    try {
      const response = await tenantFetch(`/api/pm-templates/${templateId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to delete PM template");
      }

      await fetchData();
      setToast("PM template deleted.");
    } catch (error: unknown) {
      alert(
        error instanceof Error ? error.message : "Unable to delete PM template"
      );
    }
  }

  const assignedTemplateIds = useMemo(
    () => new Set(schedules.map((schedule) => schedule.templateId)),
    [schedules]
  );
  const unassignedTemplates = useMemo(
    () => templates.filter((template) => !assignedTemplateIds.has(template.id)),
    [templates, assignedTemplateIds]
  );
  const visibleUnassignedTemplates = useMemo(
    () =>
      showInactiveOnly
        ? unassignedTemplates.filter((template) => template.status === "Inactive")
        : unassignedTemplates,
    [showInactiveOnly, unassignedTemplates]
  );

  const stats = useMemo(() => {
    const active = schedules.filter(
      (entry) =>
        entry.templateStatus === "Active" && entry.assignmentStatus === "Active"
    );
    return {
      total: new Set(active.map((entry) => entry.templateId)).size,
      inactive: templates.filter((template) => template.status === "Inactive")
        .length,
      dueSoon: new Set(
        active
          .filter((entry) => entry.dueStatus === "due_soon")
          .map((entry) => entry.templateId)
      ).size,
      missingAreas: gridSummaries.filter((entry) => entry.marker === "missing")
        .length,
    };
  }, [schedules, templates, gridSummaries]);

  return (
    <div style={sectionPanel}>
      <div style={sectionToolbar}>
        <div style={searchWrap}>
          <Search
            size={16}
            color={ONE_EYRIE.textSubtle}
            style={{ position: "absolute", left: 12, top: 12 }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PM templates or areas..."
            style={searchInput}
          />
        </div>

        {canManageStandardPms && (
          <button
            type="button"
            style={{ ...secondaryButton, ...SETTINGS_BUTTON_BASE }}
            onClick={() => setStandardModalOpen(true)}
            disabled={addingStandards}
            title={
              availableStandardCount > 0
                ? `Add ${availableStandardCount} standard PM template${
                    availableStandardCount === 1 ? "" : "s"
                  }`
                : "All standard PM templates are already added"
            }
            {...secondaryHoverHandlers(addingStandards)}
          >
            <Plus size={16} />
            Add Standard PMs
            {availableStandardCount > 0 ? ` (${availableStandardCount})` : ""}
          </button>
        )}

        <button
          type="button"
          style={{ ...primaryButton, ...SETTINGS_BUTTON_BASE }}
          onClick={openNew}
          {...forestHoverHandlers()}
        >
          <Plus size={16} />
          New PM Template
        </button>
      </div>

      {toast && (
        <div
          style={{
            marginBottom: "12px",
            padding: "10px 12px",
            borderRadius: "8px",
            border: `1px solid ${
              toast.startsWith("Error:") ? "#8A3B3B" : ONE_EYRIE.border
            }`,
            color: toast.startsWith("Error:")
              ? "#F0A3A3"
              : ONE_EYRIE.textMuted,
            background: toast.startsWith("Error:")
              ? "rgba(139, 59, 59, 0.14)"
              : "transparent",
            fontSize: "13px",
          }}
        >
          {toast}
        </div>
      )}

      <div
        className="one-eyrie-settings-stats-row one-eyrie-settings-stats-row--4"
        style={{
          display: "grid",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        {[
          { label: "Active PMs", value: stats.total },
          {
            label: "Inactive",
            value: stats.inactive,
            accent: "#9CA3AF",
            inactiveFilter: true,
          },
          { label: "Due soon", value: stats.dueSoon, accent: "#E0C47B" },
          {
            label: "Areas without PM",
            value: stats.missingAreas,
            accent: "#9CA3AF",
          },
        ].map((item) => {
          const tileContent = (
            <>
            <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", fontWeight: 700 }}>
              {item.label}
            </div>
            <div
              style={{
                color: item.accent || ONE_EYRIE.gold,
                fontSize: "26px",
                fontWeight: 800,
                lineHeight: 1.1,
                marginTop: "6px",
              }}
            >
              {item.value}
            </div>
            </>
          );
          const tileStyle: React.CSSProperties = {
            background: ONE_EYRIE.surface,
            border: `1px solid ${
              item.inactiveFilter && showInactiveOnly
                ? ONE_EYRIE.gold
                : ONE_EYRIE.border
            }`,
            borderRadius: "12px",
            padding: "14px 16px",
            textAlign: "left",
            fontFamily: "inherit",
          };

          return item.inactiveFilter ? (
            <button
              key={item.label}
              type="button"
              aria-pressed={showInactiveOnly}
              title={
                showInactiveOnly
                  ? "Show all PM templates"
                  : "Show inactive PM templates"
              }
              onClick={() => setShowInactiveOnly((current) => !current)}
              style={{ ...tileStyle, cursor: "pointer" }}
            >
              {tileContent}
            </button>
          ) : (
            <div key={item.label} style={tileStyle}>
              {tileContent}
            </div>
          );
        })}
      </div>

      {!showInactiveOnly && <div style={{ marginBottom: "20px" }}>
        <div style={{ color: ONE_EYRIE.text, fontWeight: 800, fontSize: "15px" }}>
          PM Assignment Grid
        </div>
        <div
          style={{
            color: ONE_EYRIE.textSubtle,
            fontSize: "12px",
            marginTop: "4px",
            marginBottom: "10px",
          }}
        >
          Building areas and assets — guest rooms excluded. Click an area to create a PM.
        </div>
        <PmGridLegend />
        {loading ? (
          <div style={emptyState}>Loading PM coverage…</div>
        ) : (
          <PmAssignmentGrid
            areas={areas}
            summaries={gridSummaries}
            onAreaClick={openNewForArea}
          />
        )}
      </div>}

      {visibleUnassignedTemplates.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ color: ONE_EYRIE.text, fontWeight: 800, fontSize: "15px" }}>
            Unassigned PM Templates
          </div>
          <div
            style={{
              color: ONE_EYRIE.textSubtle,
              fontSize: "12px",
              marginTop: "4px",
              marginBottom: "10px",
            }}
          >
            Assign one or more property areas and a start date before scheduling begins.
          </div>
          <div className="one-eyrie-pm-schedule-list one-eyrie-pm-schedule-list--unassigned">
            <div className="one-eyrie-pm-schedule-header">
              <span>PM Name</span>
              <span>Assignment</span>
              <span>Frequency</span>
              <span>Status</span>
              <span />
            </div>
            {visibleUnassignedTemplates.map((template) => {
              const canModify =
                !template.standardKey || canManageStandardPms;
              return (
                <div
                  key={template.id}
                  className="one-eyrie-pm-schedule-row"
                >
                  <div className="one-eyrie-pm-schedule-row__name">
                    {template.name}
                  </div>
                  <div className="one-eyrie-pm-schedule-row__area">
                    Not assigned
                  </div>
                  <div className="one-eyrie-pm-schedule-row__meta">
                    {PM_FREQUENCY_LABELS[template.frequency]}
                  </div>
                  <div>
                    <span style={statusPill}>{template.status}</span>
                  </div>
                  <div style={actionCell}>
                    {canModify && (
                      <>
                        <button
                          type="button"
                          style={iconButton}
                          title="Duplicate PM Template"
                          onClick={() => void openDuplicate(template.id)}
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          type="button"
                          style={iconButton}
                          title="Edit PM template"
                          onClick={() => void openEdit(template.id)}
                        >
                          <Pencil size={16} />
                        </button>
                      </>
                    )}
                    {canManageStandardPms && (
                      <button
                        type="button"
                        style={iconButton}
                        title="Delete PM template"
                        onClick={() => void deleteTemplate(template.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div style={{ color: ONE_EYRIE.text, fontWeight: 800, fontSize: "15px" }}>
          PM Templates by Frequency
        </div>
        <div
          style={{
            color: ONE_EYRIE.textSubtle,
            fontSize: "12px",
            marginTop: "4px",
            marginBottom: "12px",
          }}
        >
          Scheduled preventive maintenance grouped by recurrence
        </div>

        {loading ? (
          <div style={emptyState}>Loading templates…</div>
        ) : (
          PM_FREQUENCIES.map((frequency) => {
            const items = schedulesByFrequency.get(frequency) || [];
            const expanded = expandedFrequencies.has(frequency);

            return (
              <div
                key={frequency}
                style={{
                  border: `1px solid ${ONE_EYRIE.border}`,
                  borderRadius: "12px",
                  marginBottom: "10px",
                  overflow: "hidden",
                  background: ONE_EYRIE.surface,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleFrequency(frequency)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "14px 16px",
                    background: "transparent",
                    border: "none",
                    color: ONE_EYRIE.text,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: "14px" }}>
                    {PM_FREQUENCY_LABELS[frequency]}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "10px",
                      color: ONE_EYRIE.textSubtle,
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {items.length} PM{items.length === 1 ? "" : "s"}
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {expanded && (
                  <div style={{ padding: "10px 12px 14px" }}>
                    {items.length === 0 ? (
                      <div
                        style={{
                          padding: "8px 4px",
                          color: ONE_EYRIE.textMuted,
                          fontSize: "13px",
                        }}
                      >
                        No {PM_FREQUENCY_LABELS[frequency].toLowerCase()} PM templates yet.
                      </div>
                    ) : (
                      <>
                        <div className="one-eyrie-pm-schedule-list">
                          <div className="one-eyrie-pm-schedule-header">
                            <span>PM Name</span>
                            <span>Assignment</span>
                            <span>Start Date</span>
                            <span>Next Due</span>
                            <span>Status</span>
                            <span />
                          </div>
                          {items.map((group) => {
                            const dueStatus = groupDueStatus(group.schedules);
                            const dueStyles = dueStatusStyles(dueStatus);
                            const canModify =
                              !group.standardKey || canManageStandardPms;
                            const locationLabels = group.schedules.map(areaLabel);
                            const startDates = Array.from(
                              new Set(
                                group.schedules.map(
                                  (schedule) => schedule.startDate
                                )
                              )
                            );
                            const nextDueDate =
                              group.schedules
                                .map((schedule) => schedule.nextDueDate)
                                .filter(
                                  (date): date is string => Boolean(date)
                                )
                                .sort()[0] ?? null;

                            return (
                              <div
                                key={group.templateId}
                                className="one-eyrie-pm-schedule-row"
                              >
                                <div className="one-eyrie-pm-schedule-row__name">
                                  {group.templateName}
                                </div>
                                <div
                                  className="one-eyrie-pm-schedule-row__area"
                                  title={locationLabels.join(", ")}
                                >
                                  {locationLabels.length === 1
                                    ? locationLabels[0]
                                    : `${locationLabels.length} items`}
                                </div>
                                <div className="one-eyrie-pm-schedule-row__meta">
                                  {startDates.length === 1
                                    ? formatScheduleDate(startDates[0])
                                    : "Multiple"}
                                </div>
                                <div className="one-eyrie-pm-schedule-row__meta">
                                  {nextDueDate
                                    ? formatNextDueLabel(
                                        nextDueDate,
                                        dueStatus
                                      )
                                    : "—"}
                                </div>
                                <div>
                                  <span
                                    style={{
                                      ...statusPill,
                                      ...dueStyles,
                                    }}
                                  >
                                    {formatDueStatusLabel(dueStatus)}
                                  </span>
                                </div>
                                <div style={actionCell}>
                                  {canModify && (
                                    <>
                                      <button
                                        type="button"
                                        style={iconButton}
                                        title="Duplicate PM Template"
                                        onClick={() =>
                                          void openDuplicate(group.templateId)
                                        }
                                      >
                                        <Copy size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        style={iconButton}
                                        title="Edit PM template"
                                        onClick={() =>
                                          void openEdit(group.templateId)
                                        }
                                      >
                                        <Pencil size={16} />
                                      </button>
                                    </>
                                  )}
                                  {canManageStandardPms && (
                                    <button
                                      type="button"
                                      style={iconButton}
                                      title="Delete PM template"
                                      onClick={() =>
                                        void deleteTemplate(group.templateId)
                                      }
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <PmTemplateModal
        open={modalOpen}
        editingId={editingId}
        isDuplicate={isDuplicate}
        areas={areas}
        schedules={schedules}
        initial={editInitial}
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
        onClose={() => {
          setModalOpen(false);
          setEditingId(null);
          setIsDuplicate(false);
          setEditInitial(undefined);
        }}
        onSaved={async () => {
          await fetchData();
          setToast(
            isDuplicate ? "PM template duplicated." : "PM template saved."
          );
          setIsDuplicate(false);
        }}
      />

      {standardModalOpen && (
        <div style={modalOverlay}>
          <div
            style={{ ...modalBox, width: "min(520px, 94vw)" }}
            className="one-eyrie-modal"
          >
            <div style={modalHeader}>
              <h2 style={{ margin: 0 }}>Add Standard PMs</h2>
              <button
                type="button"
                style={closeButton}
                onClick={() => setStandardModalOpen(false)}
                disabled={addingStandards}
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>
            <div
              style={{
                color: ONE_EYRIE.textMuted,
                fontSize: "14px",
                lineHeight: 1.6,
              }}
            >
              <p style={{ marginTop: 0 }}>
                Add One Eyrie&apos;s standard preventive maintenance templates
                to this property.
              </p>
              <p style={{ marginBottom: 0 }}>
                These templates can be edited, assigned to one or multiple
                locations, disabled, or deleted after they are added. Existing
                standard templates will not be duplicated.
              </p>
            </div>
            <div style={modalFooter}>
              <button
                type="button"
                style={secondaryButton}
                onClick={() => setStandardModalOpen(false)}
                disabled={addingStandards}
                {...secondaryHoverHandlers(addingStandards)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={primaryButton}
                onClick={() => void addStandardPms()}
                disabled={addingStandards || availableStandardCount === 0}
                {...forestHoverHandlers()}
              >
                {addingStandards ? "Adding…" : "Add Standard PMs"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

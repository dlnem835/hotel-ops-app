"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Search } from "lucide-react";
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
  PmTemplateInput,
} from "@/app/maintenance/lib/pm-types";
import { formatPmAreaLabel } from "@/app/maintenance/lib/pm-category";
import { normalizeChecklist } from "@/app/maintenance/lib/pm-checklist-draft";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  forestHoverHandlers,
  secondaryHoverHandlers,
} from "../lib/settings-ui-interactions";
import { BuildingArea } from "../lib/buildings-types";
import PmAssignmentGrid, { PmGridLegend } from "./PmAssignmentGrid";
import PmTemplateModal from "./PmTemplateModal";

type PmTemplatesSectionProps = {
  styles: Record<string, React.CSSProperties>;
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function areaLabel(schedule: PmAssignmentSchedule): string {
  return formatPmAreaLabel({
    areaName: schedule.areaName,
    customAreaLabel: schedule.assetLabel,
  });
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

export default function PmTemplatesSection({ styles }: PmTemplatesSectionProps) {
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
  const [gridSummaries, setGridSummaries] = useState<AreaPmGridSummary[]>([]);
  const [areas, setAreas] = useState<BuildingArea[]>([]);
  const [expandedFrequencies, setExpandedFrequencies] = useState<
    Set<PmFrequency>
  >(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editInitial, setEditInitial] = useState<
    (Partial<PmTemplateInput> & { id?: number }) | undefined
  >(undefined);
  const [toast, setToast] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pmRes, areasRes] = await Promise.all([
        fetch("/api/pm-templates"),
        fetch("/api/buildings-areas"),
      ]);

      const pmData = await pmRes.json();
      const areasData = await areasRes.json();

      if (!pmRes.ok) {
        throw new Error(pmData.error || "Unable to load PM templates");
      }

      setSchedules(pmData.schedules || []);
      setGridSummaries(pmData.gridSummaries || []);
      setAreas(areasData.areas || areasData || []);
    } catch (error: unknown) {
      console.error(error);
      setToast(
        error instanceof Error ? error.message : "Unable to load PM templates"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredSchedules = useMemo(() => {
    if (!search.trim()) return schedules;
    const term = search.trim().toLowerCase();
    return schedules.filter((entry) =>
      [
        entry.templateName,
        entry.areaName,
        entry.assetLabel,
        PM_FREQUENCY_LABELS[entry.frequency],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [schedules, search]);

  const schedulesByFrequency = useMemo(() => {
    const grouped = new Map<PmFrequency, PmAssignmentSchedule[]>();
    for (const frequency of PM_FREQUENCIES) {
      grouped.set(frequency, []);
    }
    for (const schedule of filteredSchedules) {
      grouped.get(schedule.frequency)?.push(schedule);
    }
    return grouped;
  }, [filteredSchedules]);

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
    setEditInitial(undefined);
    setModalOpen(true);
  }

  function openNewForArea(areaId: number) {
    setEditingId(null);
    setEditInitial({
      assignment: {
        area_id: areaId,
        asset_label: null,
        start_date: getLocalDateString(),
      },
    });
    setModalOpen(true);
  }

  async function openEdit(templateId: number) {
    try {
      const response = await fetch(`/api/pm-templates/${templateId}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to load template");
      }

      setEditingId(templateId);
      setEditInitial({
        id: templateId,
        name: result.template.name,
        description: result.template.description,
        frequency: result.template.frequency,
        checklist: normalizeChecklist(result.template.checklist),
        status: result.template.status,
        assignment: result.assignment
          ? {
              area_id: result.assignment.area_id,
              asset_label: result.assignment.asset_label,
              start_date: result.assignment.start_date,
              end_date: result.assignment.end_date,
              status: result.assignment.status,
            }
          : undefined,
      });
      setModalOpen(true);
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Unable to load template");
    }
  }

  const stats = useMemo(() => {
    const active = schedules.filter(
      (entry) =>
        entry.templateStatus === "Active" && entry.assignmentStatus === "Active"
    );
    return {
      total: active.length,
      overdue: active.filter((entry) => entry.dueStatus === "overdue").length,
      dueSoon: active.filter((entry) => entry.dueStatus === "due_soon").length,
      missingAreas: gridSummaries.filter((entry) => entry.marker === "missing")
        .length,
    };
  }, [schedules, gridSummaries]);

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

        <button
          type="button"
          style={primaryButton}
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
            border: `1px solid ${ONE_EYRIE.border}`,
            color: ONE_EYRIE.textMuted,
            fontSize: "13px",
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        {[
          { label: "Active PMs", value: stats.total },
          { label: "Overdue", value: stats.overdue, accent: "#E57373" },
          { label: "Due soon", value: stats.dueSoon, accent: "#E0C47B" },
          {
            label: "Areas without PM",
            value: stats.missingAreas,
            accent: "#9CA3AF",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: ONE_EYRIE.surface,
              border: `1px solid ${ONE_EYRIE.border}`,
              borderRadius: "12px",
              padding: "14px 16px",
            }}
          >
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
          </div>
        ))}
      </div>

      <div style={{ marginBottom: "20px" }}>
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
      </div>

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
                            <span>Area</span>
                            <span>Start Date</span>
                            <span>Next Due</span>
                            <span>Status</span>
                            <span />
                          </div>
                          {items.map((schedule) => {
                            const dueStyles = dueStatusStyles(schedule.dueStatus);

                            return (
                              <div
                                key={schedule.assignmentId}
                                className="one-eyrie-pm-schedule-row"
                              >
                                <div className="one-eyrie-pm-schedule-row__name">
                                  {schedule.templateName}
                                </div>
                                <div className="one-eyrie-pm-schedule-row__area">
                                  {areaLabel(schedule)}
                                </div>
                                <div className="one-eyrie-pm-schedule-row__meta">
                                  {formatScheduleDate(schedule.startDate)}
                                </div>
                                <div className="one-eyrie-pm-schedule-row__meta">
                                  {schedule.nextDueDate
                                    ? formatNextDueLabel(
                                        schedule.nextDueDate,
                                        schedule.dueStatus
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
                                    {formatDueStatusLabel(schedule.dueStatus)}
                                  </span>
                                </div>
                                <div style={actionCell}>
                                  <button
                                    type="button"
                                    style={iconButton}
                                    title="Edit PM template"
                                    onClick={() => void openEdit(schedule.templateId)}
                                  >
                                    <Pencil size={16} />
                                  </button>
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
          setEditInitial(undefined);
        }}
        onSaved={async () => {
          await fetchData();
          setToast("PM template saved.");
        }}
      />
    </div>
  );
}

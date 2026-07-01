"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, FileUp, Pencil, Plus, Search, Trash2, Wand2, X } from "lucide-react";
import PropertyGrid, { StatusLegend } from "./PropertyGrid";
import HotelPropertyInfoPanel from "./HotelPropertyInfoPanel";
import {
  AREA_STATUSES,
  AREA_TYPES,
  AreaStatus,
  AreaType,
  BuildingArea,
  BuildingAreaInput,
  FLOOR_LOCATIONS,
} from "../lib/buildings-types";
import { FLAT_RED, FOREST, NEUTRAL_PILL, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { formatSetupResult, formatStandardAreasResult, getMissingStandardAreas, GOLD, parseCsvRows } from "../lib/buildings-areas";
import {
  groupFilteredAreas,
  isGroupFullySelected,
  isGroupPartiallySelected,
} from "../lib/rooms-areas-groups";
import {
  applyGoldHover,
  forestHoverHandlers,
  goldHoverHandlers,
  resetButtonHover,
  secondaryHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "../lib/settings-ui-interactions";

type RoomsAreasSectionProps = {
  styles: Record<string, React.CSSProperties>;
};

type AreaDraft = {
  name: string;
  area_type: AreaType;
  floor_location: string;
  status: BuildingArea["status"];
  inspection_enabled: string;
};

const defaultDraft = (): AreaDraft => ({
  name: "",
  area_type: "Guest Room",
  floor_location: "Floor 1",
  status: "Active",
  inspection_enabled: "true",
});

type RoomRangeRow = {
  id: string;
  startRoom: string;
  endRoom: string;
  floor: string;
  areaType: AreaType;
  skipRooms: string;
};

function createRoomRange(index = 0): RoomRangeRow {
  const floor =
    index < FLOOR_LOCATIONS.length ? FLOOR_LOCATIONS[index] : "Floor 1";

  return {
    id: `range-${Date.now()}-${index}`,
    startRoom: index === 0 ? "101" : "",
    endRoom: index === 0 ? "125" : "",
    floor,
    areaType: "Guest Room",
    skipRooms: "",
  };
}

function AreaAccordion({
  groupKey,
  label,
  areas,
  expanded,
  selectedIds,
  onToggleExpanded,
  onToggleGroupSelection,
  onToggleSelect,
  onEdit,
  renderStatusPill,
  actionCell,
  iconButton,
  buttonBase,
}: {
  groupKey: string;
  label: string;
  areas: BuildingArea[];
  expanded: boolean;
  selectedIds: Set<number>;
  onToggleExpanded: (key: string) => void;
  onToggleGroupSelection: (areas: BuildingArea[]) => void;
  onToggleSelect: (id: number) => void;
  onEdit: (area: BuildingArea) => void;
  renderStatusPill: (status: BuildingArea["status"]) => React.ReactNode;
  actionCell: React.CSSProperties;
  iconButton: React.CSSProperties;
  buttonBase: React.CSSProperties;
}) {
  const groupSelected = isGroupFullySelected(areas, selectedIds);
  const groupPartial = isGroupPartiallySelected(areas, selectedIds);

  return (
    <div
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
        onClick={() => onToggleExpanded(groupKey)}
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
        <span style={{ fontWeight: 800, fontSize: "14px" }}>{label}</span>
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
          {areas.length} location{areas.length === 1 ? "" : "s"}
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "10px 12px 14px" }}>
          <div className="one-eyrie-area-schedule-list">
            <div className="one-eyrie-area-schedule-header">
              <span>
                <input
                  type="checkbox"
                  checked={groupSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = groupPartial;
                  }}
                  onChange={() => onToggleGroupSelection(areas)}
                  aria-label={`Select all in ${label}`}
                />
              </span>
              <span>Name</span>
              <span>Area Type</span>
              <span>Floor / Location</span>
              <span>Status</span>
              <span />
            </div>
            {areas.map((area) => (
              <div
                key={area.id}
                className="one-eyrie-area-schedule-row"
                data-selected={selectedIds.has(area.id) ? "true" : "false"}
              >
                <span>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(area.id)}
                    onChange={() => onToggleSelect(area.id)}
                    aria-label={`Select ${area.name}`}
                  />
                </span>
                <div className="one-eyrie-area-schedule-row__name">{area.name}</div>
                <div className="one-eyrie-area-schedule-row__meta">{area.area_type}</div>
                <div className="one-eyrie-area-schedule-row__meta">
                  {area.floor_location}
                </div>
                <div>{renderStatusPill(area.status)}</div>
                <div style={actionCell}>
                  <button
                    type="button"
                    style={{ ...iconButton, ...buttonBase }}
                    title="Edit location"
                    onClick={() => onEdit(area)}
                    onMouseEnter={(e) => applyGoldHover(e, "icon")}
                    onMouseLeave={(e) => resetButtonHover(e, "icon")}
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "block",
        color: "#C9C9C9",
        fontSize: "12px",
        fontWeight: 700,
        marginBottom: "6px",
      }}
    >
      {children}
    </span>
  );
}

function FloorLocationSelect({
  value,
  onChange,
  inputStyle,
}: {
  value: string;
  onChange: (value: string) => void;
  inputStyle: React.CSSProperties;
}) {
  const hasCustomValue =
    value && !FLOOR_LOCATIONS.includes(value as (typeof FLOOR_LOCATIONS)[number]);

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {hasCustomValue && <option value={value}>{value}</option>}
      {FLOOR_LOCATIONS.map((floor) => (
        <option key={floor} value={floor}>
          {floor}
        </option>
      ))}
    </select>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div style={statTile}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color: accent || GOLD }}>{value}</div>
    </div>
  );
}

const statsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "12px",
  marginBottom: "14px",
};

const statTile: React.CSSProperties = {
  background: "#211F1B",
  border: "1px solid #3A352E",
  borderRadius: "12px",
  padding: "14px 16px",
};

const statLabel: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

const statValue: React.CSSProperties = {
  fontSize: "26px",
  fontWeight: 800,
  lineHeight: 1,
};

export default function RoomsAreasSection({ styles }: RoomsAreasSectionProps) {
  const {
    sectionPanel,
    sectionToolbar,
    searchWrap,
    searchInput,
    primaryButton,
    secondaryButton,
    tableHeader,
    tableRow,
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

  const csvInputRef = useRef<HTMLInputElement>(null);

  const [areas, setAreas] = useState<BuildingArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAreaType, setFilterAreaType] = useState("All");
  const [filterFloor, setFilterFloor] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<{
    text: string;
    variant: "success" | "warning";
  } | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<AreaDraft>(defaultDraft());

  const [wizardOpen, setWizardOpen] = useState(false);

  const [roomRanges, setRoomRanges] = useState<RoomRangeRow[]>([createRoomRange(0)]);
  const [addStandardAreas, setAddStandardAreas] = useState(true);
  const [generateRooms, setGenerateRooms] = useState(true);

  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState<BuildingAreaInput[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const fetchAreas = useCallback(async () => {
    setLoading(true);

    const response = await fetch("/api/buildings-areas");
    const result = await response.json();

    if (!response.ok) {
      console.error("Error loading rooms & areas:", result.error);
      setAreas([]);
      setLoading(false);
      return;
    }

    setAreas(result.areas || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAreas() {
      setLoading(true);

      const response = await fetch("/api/buildings-areas");
      const result = await response.json();

      if (cancelled) return;

      if (!response.ok) {
        console.error("Error loading rooms & areas:", result.error);
        setAreas([]);
        setLoading(false);
        return;
      }

      setAreas(result.areas || []);
      setLoading(false);
    }

    void loadAreas();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(text: string, variant: "success" | "warning" = "success") {
    setToast({ text, variant });
  }

  const locationStats = useMemo(() => {
    return {
      total: areas.length,
      guestRooms: areas.filter((a) => a.area_type === "Guest Room").length,
      publicAreas: areas.filter((a) => a.area_type === "Public Area").length,
      outOfService: areas.filter((a) => a.status === "Out of Service").length,
    };
  }, [areas]);

  const filteredAreas = useMemo(() => {
    const term = search.trim().toLowerCase();

    return areas.filter((area) => {
      const matchesSearch =
        !term ||
        `${area.name} ${area.area_type} ${area.floor_location} ${area.status}`
          .toLowerCase()
          .includes(term);

      const matchesAreaType =
        filterAreaType === "All" || area.area_type === filterAreaType;

      const matchesFloor =
        filterFloor === "All" || area.floor_location === filterFloor;

      const matchesStatus =
        filterStatus === "All" || area.status === filterStatus;

      return matchesSearch && matchesAreaType && matchesFloor && matchesStatus;
    });
  }, [areas, search, filterAreaType, filterFloor, filterStatus]);

  const groupedAreas = useMemo(
    () => groupFilteredAreas(filteredAreas),
    [filteredAreas]
  );

  function toggleGroup(groupKey: string) {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function toggleGroupSelection(groupAreas: BuildingArea[]) {
    const allSelected = isGroupFullySelected(groupAreas, selectedIds);
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const area of groupAreas) {
        if (allSelected) next.delete(area.id);
        else next.add(area.id);
      }
      return next;
    });
  }

  const selectedCount = selectedIds.size;

  const visibleSelectedCount = useMemo(
    () => filteredAreas.filter((area) => selectedIds.has(area.id)).length,
    [filteredAreas, selectedIds]
  );

  const allVisibleSelected =
    filteredAreas.length > 0 && visibleSelectedCount === filteredAreas.length;

  const someVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < filteredAreas.length;

  const hasExistingGuestRooms = useMemo(
    () => areas.some((area) => area.area_type === "Guest Room"),
    [areas]
  );

  const missingStandardAreas = useMemo(
    () => getMissingStandardAreas(areas),
    [areas]
  );

  const hasValidRoomRanges = useMemo(
    () =>
      generateRooms &&
      roomRanges.some((range) => {
        const start = Number(range.startRoom);
        const end = Number(range.endRoom);
        return (
          range.startRoom.trim() !== "" &&
          range.endRoom.trim() !== "" &&
          !Number.isNaN(start) &&
          !Number.isNaN(end)
        );
      }),
    [roomRanges, generateRooms]
  );

  const hasValidCsvImport =
    importFileName.length > 0 &&
    importPreview.length > 0 &&
    importErrors.length === 0;

  const canRunWizard =
    hasValidRoomRanges || addStandardAreas || hasValidCsvImport;

  function openWizard() {
    const hasRooms = areas.some((area) => area.area_type === "Guest Room");
    setGenerateRooms(!hasRooms);
    setRoomRanges(
      hasRooms
        ? [
            {
              id: `range-${Date.now()}`,
              startRoom: "",
              endRoom: "",
              floor: "Floor 1",
              areaType: "Guest Room" as AreaType,
              skipRooms: "",
            },
          ]
        : [createRoomRange(0)]
    );
    setAddStandardAreas(true);
    resetWizardImport();
    setWizardOpen(true);
  }

  function addRoomRange() {
    setRoomRanges((prev) => [...prev, createRoomRange(prev.length)]);
  }

  function removeRoomRange(id: string) {
    setRoomRanges((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((range) => range.id !== id);
    });
  }

  function updateRoomRange(id: string, patch: Partial<RoomRangeRow>) {
    setRoomRanges((prev) =>
      prev.map((range) => (range.id === id ? { ...range, ...patch } : range))
    );
  }

  function resetWizardImport() {
    setImportFileName("");
    setImportPreview([]);
    setImportErrors([]);
    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
  }

  function closeWizard() {
    setWizardOpen(false);
    setGenerateRooms(true);
    setRoomRanges([createRoomRange(0)]);
    setAddStandardAreas(true);
    resetWizardImport();
  }

  async function addMissingStandardAreas() {
    if (missingStandardAreas.length === 0) {
      showToast("All standard hotel areas are already in your property.", "warning");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/buildings-areas/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "standard" }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to add standard areas");
      }

      await fetchAreas();
      showToast(
        formatStandardAreasResult(
          result.created ?? 0,
          result.skipped ?? 0,
          result.addedNames ?? []
        ),
        result.created > 0 ? "success" : "warning"
      );
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Unable to add standard areas");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft<K extends keyof AreaDraft>(key: K, value: AreaDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function areaToDraft(area: BuildingArea): AreaDraft {
    return {
      name: area.name,
      area_type: area.area_type,
      floor_location: area.floor_location,
      status: area.status,
      inspection_enabled: area.inspection_enabled ? "true" : "false",
    };
  }

  function openNew() {
    setEditingId(null);
    setDraft(defaultDraft());
    setEditModalOpen(true);
  }

  function openEdit(area: BuildingArea) {
    setEditingId(area.id);
    setDraft(areaToDraft(area));
    setEditModalOpen(true);
  }

  function closeEditModal() {
    setEditModalOpen(false);
    setEditingId(null);
    setDraft(defaultDraft());
  }

  async function saveArea() {
    setSaving(true);

    const payload = {
      name: draft.name.trim(),
      area_type: draft.area_type,
      floor_location: draft.floor_location.trim(),
      status: draft.status,
      inspection_enabled: draft.inspection_enabled === "true",
    };

    const response = await fetch("/api/buildings-areas", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      if (response.status === 409 && result.duplicate) {
        showToast("This location already exists. Skipped 1 duplicate.", "warning");
        return;
      }
      alert(result.error || "Unable to save location");
      return;
    }

    await fetchAreas();
    closeEditModal();
    showToast(editingId ? "Location updated." : "Location created.");
  }

  async function deleteArea(id: number) {
    if (!confirm("Delete this location?")) return;

    setSaving(true);

    const response = await fetch(`/api/buildings-areas?id=${id}`, {
      method: "DELETE",
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to delete location");
      return;
    }

    await fetchAreas();
    showToast("Location deleted.");
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredAreas.forEach((area) => next.delete(area.id));
      } else {
        filteredAreas.forEach((area) => next.add(area.id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function bulkDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    if (
      !confirm(`Delete ${ids.length} selected rooms/areas?`)
    ) {
      return;
    }

    setSaving(true);

    const response = await fetch("/api/buildings-areas/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk-delete", ids }),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to delete selected locations");
      return;
    }

    clearSelection();
    await fetchAreas();
    showToast(`Deleted ${result.deleted} location(s).`);
  }

  async function bulkUpdateStatus(status: AreaStatus) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;

    setSaving(true);

    const response = await fetch("/api/buildings-areas/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "bulk-status", ids, status }),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to update selected locations");
      return;
    }

    clearSelection();
    await fetchAreas();
    showToast(`Updated ${result.updated} location(s) to ${status}.`);
  }

  function handleCsvFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setImportFileName("");
      setImportPreview([]);
      setImportErrors(["Only CSV files are supported."]);
      return;
    }

    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { records, errors } = parseCsvRows(text);
      setImportPreview(records);
      setImportErrors(errors);
    };
    reader.readAsText(file);
  }

  async function runWizard() {
    setSaving(true);

    const validRanges = generateRooms
      ? roomRanges
          .filter((range) => {
            const start = Number(range.startRoom);
            const end = Number(range.endRoom);
            return (
              range.startRoom.trim() !== "" &&
              range.endRoom.trim() !== "" &&
              !Number.isNaN(start) &&
              !Number.isNaN(end)
            );
          })
          .map((range) => ({
            startRoom: Number(range.startRoom),
            endRoom: Number(range.endRoom),
            floor: range.floor,
            areaType: range.areaType,
            skipRooms: range.skipRooms.trim(),
          }))
      : [];

    const body = {
      action: "wizard",
      roomRanges: validRanges,
      addStandardAreas,
      importRecords: hasValidCsvImport ? importPreview : [],
    };

    const response = await fetch("/api/buildings-areas/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to complete setup");
      return;
    }

    await fetchAreas();

    const message = formatSetupResult(result.created ?? 0, result.skipped ?? 0);
    showToast(message, result.skipped > 0 && result.created === 0 ? "warning" : "success");
    closeWizard();
  }

  function renderStatusPill(status: BuildingArea["status"]) {
    const isActive = status === "Active";
    const isOutOfService = status === "Out of Service";

    return (
      <span
        style={{
          ...statusPill,
          borderColor: isActive ? FOREST.border : isOutOfService ? FLAT_RED.border : NEUTRAL_PILL.border,
          color: isActive ? FOREST.text : isOutOfService ? FLAT_RED.text : NEUTRAL_PILL.text,
        }}
      >
        {status}
      </span>
    );
  }

  const buttonBase = SETTINGS_BUTTON_BASE;

  return (
    <div style={sectionPanel}>
      {toast && (
        <div
          style={{
            marginBottom: "14px",
            padding: "12px 14px",
            borderRadius: "10px",
            border: `1px solid ${toast.variant === "warning" ? "#C8A96A" : GOLD}`,
            color: toast.variant === "warning" ? "#E8D5A8" : GOLD,
            background:
              toast.variant === "warning"
                ? "rgba(200,169,106,0.1)"
                : "rgba(200,169,106,0.06)",
            fontWeight: 700,
            fontSize: "14px",
          }}
        >
          {toast.text}
        </div>
      )}

      <HotelPropertyInfoPanel inputStyle={input} />

      <div className="one-eyrie-settings-stats-row one-eyrie-settings-stats-row--4" style={statsRow}>
        <StatTile label="Total Locations" value={locationStats.total} />
        <StatTile label="Guest Rooms" value={locationStats.guestRooms} />
        <StatTile label="Public Areas" value={locationStats.publicAreas} />
        <StatTile
          label="Out of Service"
          value={locationStats.outOfService}
          accent={locationStats.outOfService > 0 ? "#8B5252" : undefined}
        />
      </div>

      <StatusLegend />

      <PropertyGrid areas={areas} onTileClick={openEdit} />

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
            placeholder="Search rooms & areas..."
            style={searchInput}
          />
        </div>

        <button
          type="button"
          style={{ ...secondaryButton, ...buttonBase }}
          onClick={() => void addMissingStandardAreas()}
          disabled={saving}
          title={
            missingStandardAreas.length === 0
              ? "All standard hotel areas are already added"
              : `Add ${missingStandardAreas.length} missing standard area${
                  missingStandardAreas.length === 1 ? "" : "s"
                } without changing guest rooms`
          }
          {...secondaryHoverHandlers(saving)}
        >
          <Plus size={16} />
          Add Standard Areas
          {missingStandardAreas.length > 0
            ? ` (${missingStandardAreas.length})`
            : ""}
        </button>

        <button
          type="button"
          style={{ ...secondaryButton, ...buttonBase }}
          onClick={openWizard}
          disabled={saving}
          {...secondaryHoverHandlers(saving)}
        >
          <Wand2 size={16} />
          Bulk Manage
        </button>

        <button
          type="button"
          style={{ ...primaryButton, ...buttonBase }}
          onClick={openNew}
          disabled={saving}
          {...forestHoverHandlers()}
        >
          <Plus size={16} />
          New Area
        </button>
      </div>

      <div className="one-eyrie-settings-filter-row">
        <select
          value={filterAreaType}
          onChange={(e) => setFilterAreaType(e.target.value)}
          className="one-eyrie-settings-filter-select"
        >
          <option value="All">All Area Types</option>
          {AREA_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={filterFloor}
          onChange={(e) => setFilterFloor(e.target.value)}
          className="one-eyrie-settings-filter-select"
        >
          <option value="All">All Floors / Locations</option>
          {FLOOR_LOCATIONS.map((floor) => (
            <option key={floor} value={floor}>
              {floor}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="one-eyrie-settings-filter-select"
        >
          <option value="All">All Statuses</option>
          {AREA_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {selectedCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "14px",
            padding: "12px 14px",
            borderRadius: "12px",
            border: `1px solid ${GOLD}`,
            background: "rgba(200,169,106,0.08)",
          }}
        >
          <span style={{ color: GOLD, fontWeight: 800, marginRight: "6px" }}>
            {selectedCount} selected
          </span>

          <button
            type="button"
            style={{
              ...secondaryButton,
              ...buttonBase,
              height: "38px",
              borderColor: FLAT_RED.border,
              color: FLAT_RED.text,
            }}
            onClick={bulkDeleteSelected}
            disabled={saving}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 12px rgba(139, 82, 82, 0.35)";
              e.currentTarget.style.borderColor = FLAT_RED.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = FLAT_RED.border;
            }}
          >
            <Trash2 size={15} />
            Delete Selected
          </button>

          <button
            type="button"
            style={{ ...secondaryButton, ...buttonBase, height: "38px" }}
            onClick={() => bulkUpdateStatus("Active")}
            disabled={saving}
            {...secondaryHoverHandlers()}
          >
            Mark Active
          </button>

          <button
            type="button"
            style={{ ...secondaryButton, ...buttonBase, height: "38px" }}
            onClick={() => bulkUpdateStatus("Out of Service")}
            disabled={saving}
            {...secondaryHoverHandlers()}
          >
            Mark Out of Service
          </button>

          <button
            type="button"
            style={{ ...secondaryButton, ...buttonBase, height: "38px" }}
            onClick={() => bulkUpdateStatus("Inactive")}
            disabled={saving}
            {...secondaryHoverHandlers()}
          >
            Mark Inactive
          </button>

          <button
            type="button"
            style={{ ...secondaryButton, ...buttonBase, height: "38px" }}
            onClick={clearSelection}
            disabled={saving}
            {...secondaryHoverHandlers()}
          >
            Clear Selection
          </button>
        </div>
      )}

      <div style={{ marginTop: "8px" }}>
        <div
          style={{
            color: ONE_EYRIE.text,
            fontWeight: 800,
            fontSize: "15px",
            marginBottom: "4px",
          }}
        >
          Rooms &amp; Areas List
        </div>
        <div
          style={{
            color: ONE_EYRIE.textSubtle,
            fontSize: "12px",
            marginBottom: "12px",
          }}
        >
          Grouped by floor for guest rooms and building areas for utilities
        </div>

        {filteredAreas.length > 0 && (
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              color: ONE_EYRIE.textMuted,
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            <input
              type="checkbox"
              checked={allVisibleSelected}
              ref={(el) => {
                if (el) el.indeterminate = someVisibleSelected;
              }}
              onChange={toggleSelectAllVisible}
              disabled={filteredAreas.length === 0}
            />
            Select all visible locations
          </label>
        )}

        {loading ? (
          <div style={emptyState}>Loading locations...</div>
        ) : groupedAreas.length === 0 ? (
          <div style={emptyState}>No locations found.</div>
        ) : (
          groupedAreas.map((group) => (
            <AreaAccordion
              key={group.key}
              groupKey={group.key}
              label={group.label}
              areas={group.areas}
              expanded={expandedGroups.has(group.key)}
              selectedIds={selectedIds}
              onToggleExpanded={toggleGroup}
              onToggleGroupSelection={toggleGroupSelection}
              onToggleSelect={toggleSelect}
              onEdit={openEdit}
              renderStatusPill={renderStatusPill}
              actionCell={actionCell}
              iconButton={iconButton}
              buttonBase={buttonBase}
            />
          ))
        )}
      </div>

      {editModalOpen && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, maxWidth: "720px" }} className="one-eyrie-modal">
            <div style={modalHeader}>
              <h2 style={{ margin: 0 }}>
                {editingId ? "Edit" : "New"} Location
              </h2>
              <button
                type="button"
                style={{ ...closeButton, ...buttonBase }}
                onClick={closeEditModal}
                onMouseEnter={(e) => applyGoldHover(e, "icon")}
                onMouseLeave={(e) => resetButtonHover(e, "icon")}
              >
                <X size={22} />
              </button>
            </div>

            <div style={formStack}>
              <input
                value={draft.name}
                onChange={(e) => updateDraft("name", e.target.value)}
                placeholder={
                  draft.area_type === "Guest Room"
                    ? "Room number — 101, 102..."
                    : "Area name — Lobby, Pool..."
                }
                style={input}
              />

              <div style={twoCol}>
                <select
                  value={draft.area_type}
                  onChange={(e) =>
                    updateDraft("area_type", e.target.value as AreaType)
                  }
                  style={input}
                >
                  {AREA_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>

                <FloorLocationSelect
                  value={draft.floor_location || "Floor 1"}
                  onChange={(value) => updateDraft("floor_location", value)}
                  inputStyle={input}
                />
              </div>

              <select
                value={draft.status}
                onChange={(e) =>
                  updateDraft("status", e.target.value as BuildingArea["status"])
                }
                style={input}
              >
                {AREA_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: "#FFFFFF",
                  fontWeight: 700,
                }}
              >
                <input
                  type="checkbox"
                  checked={draft.inspection_enabled === "true"}
                  onChange={(e) =>
                    updateDraft(
                      "inspection_enabled",
                      e.target.checked ? "true" : "false"
                    )
                  }
                />
                Inspection Enabled
              </label>
            </div>

            <div style={modalFooter}>
              <button
                type="button"
                style={{ ...secondaryButton, ...buttonBase }}
                onClick={closeEditModal}
                {...secondaryHoverHandlers()}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{ ...primaryButton, ...buttonBase }}
                onClick={saveArea}
                disabled={saving}
                {...forestHoverHandlers(saving)}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {wizardOpen && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, width: "860px", maxHeight: "90vh", overflowY: "auto" }} className="one-eyrie-modal">
            <div style={modalHeader}>
              <h2 style={{ margin: 0 }}>Bulk Manage</h2>
              <button
                type="button"
                style={{ ...closeButton, ...buttonBase }}
                onClick={closeWizard}
                onMouseEnter={(e) => applyGoldHover(e, "icon")}
                onMouseLeave={(e) => resetButtonHover(e, "icon")}
              >
                <X size={22} />
              </button>
            </div>

            <p style={{ color: "#C9C9C9", marginTop: 0 }}>
              Set up your hotel in one step — generate rooms, add standard areas, or
              import a CSV. Existing locations are never changed or removed.
            </p>

            <div style={formStack}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: "#FFFFFF",
                  fontWeight: 700,
                }}
              >
                <input
                  type="checkbox"
                  checked={generateRooms}
                  onChange={(e) => setGenerateRooms(e.target.checked)}
                />
                Generate guest rooms
                {hasExistingGuestRooms ? " (optional — existing rooms are kept)" : ""}
              </label>

              {generateRooms && (
                <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    color: GOLD,
                    fontWeight: 800,
                    fontSize: "14px",
                    letterSpacing: "0.3px",
                  }}
                >
                  Generate Room Range
                </div>
                <button
                  type="button"
                  style={{ ...primaryButton, ...buttonBase, height: "38px" }}
                  onClick={addRoomRange}
                  {...forestHoverHandlers(saving)}
                >
                  <Plus size={16} />
                  Add Floor
                </button>
              </div>

              {roomRanges.map((range, index) => (
                <div
                  key={range.id}
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    border: "1px solid #3A352E",
                    background: "#211F1B",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ color: GOLD, fontWeight: 800, fontSize: "13px" }}>
                      Floor Range {index + 1}
                    </span>
                    {roomRanges.length > 1 && (
                      <button
                        type="button"
                        style={{ ...iconButton, ...buttonBase }}
                        onClick={() => removeRoomRange(range.id)}
                        title="Remove this floor range"
                        onMouseEnter={(e) => applyGoldHover(e, "icon")}
                        onMouseLeave={(e) => resetButtonHover(e, "icon")}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div style={twoCol}>
                    <div>
                      <FieldLabel>Starting Room Number</FieldLabel>
                      <input
                        value={range.startRoom}
                        onChange={(e) =>
                          updateRoomRange(range.id, { startRoom: e.target.value })
                        }
                        placeholder="101"
                        style={input}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <FieldLabel>Ending Room Number</FieldLabel>
                      <input
                        value={range.endRoom}
                        onChange={(e) =>
                          updateRoomRange(range.id, { endRoom: e.target.value })
                        }
                        placeholder="125"
                        style={input}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div style={twoCol}>
                    <div>
                      <FieldLabel>Floor / Location</FieldLabel>
                      <FloorLocationSelect
                        value={range.floor}
                        onChange={(value) =>
                          updateRoomRange(range.id, { floor: value })
                        }
                        inputStyle={input}
                      />
                    </div>
                    <div>
                      <FieldLabel>Area Type</FieldLabel>
                      <select
                        value={range.areaType}
                        onChange={(e) =>
                          updateRoomRange(range.id, {
                            areaType: e.target.value as AreaType,
                          })
                        }
                        style={input}
                      >
                        {AREA_TYPES.map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Skip Rooms</FieldLabel>
                    <input
                      value={range.skipRooms}
                      onChange={(e) =>
                        updateRoomRange(range.id, { skipRooms: e.target.value })
                      }
                      placeholder="Skip Rooms — e.g. 113,114"
                      style={input}
                      autoComplete="off"
                    />
                  </div>
                </div>
              ))}

              <div
                style={{
                  height: "1px",
                  background: "#3A352E",
                  margin: "6px 0",
                }}
              />
                </>
              )}

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  color: "#FFFFFF",
                  fontWeight: 700,
                }}
              >
                <input
                  type="checkbox"
                  checked={addStandardAreas}
                  onChange={(e) => setAddStandardAreas(e.target.checked)}
                />
                Add Standard Hotel Areas (Lobby, Pool, Hallways, etc.)
              </label>
              <p style={{ color: "#9CA3AF", margin: "6px 0 0", fontSize: "12px" }}>
                Adds only missing areas from the One Eyrie standard list — including
                Hotel / Building / Main — without changing existing guest rooms.
                {missingStandardAreas.length > 0
                  ? ` ${missingStandardAreas.length} area${
                      missingStandardAreas.length === 1 ? "" : "s"
                    } available to add.`
                  : " All standard areas are already present."}
              </p>

              <div
                style={{
                  height: "1px",
                  background: "#3A352E",
                  margin: "6px 0",
                }}
              />

              <div
                style={{
                  color: GOLD,
                  fontWeight: 800,
                  fontSize: "14px",
                  letterSpacing: "0.3px",
                }}
              >
                Optional CSV Import
              </div>

              <p style={{ color: "#C9C9C9", margin: 0, fontSize: "13px" }}>
                Columns: name, area_type, floor_location, status
              </p>

              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvFile(file);
                }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={{ ...secondaryButton, ...buttonBase }}
                  onClick={() => csvInputRef.current?.click()}
                  {...secondaryHoverHandlers()}
                >
                  <FileUp size={16} />
                  Choose CSV File
                </button>

                {importFileName ? (
                  <span style={{ color: "#E5E7EB", fontWeight: 600, fontSize: "14px" }}>
                    Selected: {importFileName}
                  </span>
                ) : (
                  <span style={{ color: "#9CA3AF", fontSize: "14px" }}>
                    No file selected
                  </span>
                )}

                {importFileName && (
                  <button
                    type="button"
                    style={{
                      ...secondaryButton,
                      ...buttonBase,
                      height: "36px",
                      padding: "0 12px",
                      fontSize: "13px",
                    }}
                    onClick={resetWizardImport}
                    {...secondaryHoverHandlers()}
                  >
                    Clear File
                  </button>
                )}
              </div>

              {importErrors.length > 0 && (
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: `1px solid ${FLAT_RED.border}`,
                    color: FLAT_RED.text,
                    fontSize: "13px",
                  }}
                >
                  {importErrors.map((error) => (
                    <div key={error}>{error}</div>
                  ))}
                </div>
              )}

              {importPreview.length > 0 && importErrors.length === 0 && (
                <div
                  style={{
                    maxHeight: "220px",
                    overflowY: "auto",
                    border: "1px solid #3A352E",
                    borderRadius: "10px",
                  }}
                >
                  <div
                    style={{
                      ...tableHeader,
                      position: "sticky",
                      top: 0,
                      background: "#211F1B",
                    }}
                  >
                    <div>Name</div>
                    <div>Area Type</div>
                    <div>Floor / Location</div>
                    <div>Status</div>
                    <div />
                  </div>
                  {importPreview.slice(0, 50).map((row, index) => (
                    <div key={`${row.name}-${index}`} style={tableRow}>
                      <div style={rowText}>{row.name}</div>
                      <div style={rowText}>{row.area_type}</div>
                      <div style={rowText}>{row.floor_location}</div>
                      <div style={rowText}>{row.status}</div>
                      <div />
                    </div>
                  ))}
                  {importPreview.length > 50 && (
                    <div style={{ ...emptyState, fontSize: "13px" }}>
                      Showing first 50 of {importPreview.length} rows.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={modalFooter}>
              <button
                type="button"
                style={{ ...secondaryButton, ...buttonBase }}
                onClick={closeWizard}
                {...secondaryHoverHandlers()}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{ ...primaryButton, ...buttonBase }}
                onClick={runWizard}
                disabled={saving || !canRunWizard}
                {...forestHoverHandlers(saving || !canRunWizard)}
              >
                {saving ? "Setting up..." : "Run Setup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

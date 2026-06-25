"use client";

import { useEffect, useMemo, useState } from "react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  forestHoverHandlers,
  PRIMARY_BUTTON,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";
import { BuildingArea } from "@/app/settings/lib/buildings-types";
import { WorkOrderInput, WorkOrderPriority } from "../lib/maintenance-types";
import {
  getActiveGuestRooms,
  getGroupedNonGuestAreas,
  inferInitialLocationSelection,
  resolveWorkOrderLocation,
} from "../lib/work-order-location";

export type WorkOrderModalInitialValues = Partial<WorkOrderInput> & {
  subject?: string;
};

type WorkOrderModalProps = {
  open: boolean;
  initialValues?: WorkOrderModalInitialValues;
  createdBy?: string | null;
  onClose: () => void;
  onCreated?: () => void;
};

const fieldLabel: React.CSSProperties = {
  color: ONE_EYRIE.textSubtle,
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: ONE_EYRIE.black,
  color: ONE_EYRIE.text,
  border: `1px solid ${ONE_EYRIE.borderInput}`,
  borderRadius: "10px",
  padding: "10px 12px",
  fontSize: "14px",
  outline: "none",
};

export default function WorkOrderModal({
  open,
  initialValues,
  createdBy,
  onClose,
  onCreated,
}: WorkOrderModalProps) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<WorkOrderPriority>("Normal");
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [otherLocation, setOtherLocation] = useState("");
  const [areas, setAreas] = useState<BuildingArea[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guestRooms = useMemo(() => getActiveGuestRooms(areas), [areas]);
  const groupedAreas = useMemo(() => getGroupedNonGuestAreas(areas), [areas]);
  const nonGuestAreas = useMemo(
    () => groupedAreas.flatMap((group) => group.areas),
    [groupedAreas]
  );

  const showOtherLocation =
    !selectedRoomId && !selectedAreaId;

  useEffect(() => {
    if (!open) return;

    async function loadAreas() {
      setAreasLoading(true);
      const response = await fetch("/api/buildings-areas");
      const result = await response.json();
      setAreasLoading(false);

      if (response.ok) {
        setAreas(result.areas || []);
      }
    }

    void loadAreas();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setSubject(initialValues?.subject || "");
    setDescription(
      initialValues?.description || initialValues?.source_note || ""
    );
    setPriority(initialValues?.priority || "Normal");
    setError(null);

    const selection = inferInitialLocationSelection(
      areas,
      initialValues?.area_id ?? null,
      initialValues?.area_label ?? null
    );
    setSelectedRoomId(selection.selectedRoomId);
    setSelectedAreaId(selection.selectedAreaId);
    setOtherLocation(selection.otherLocation);
  }, [open, initialValues, areas]);

  if (!open) return null;

  async function handleSubmit() {
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const location = resolveWorkOrderLocation({
      selectedRoomId,
      selectedAreaId,
      otherLocation,
      rooms: guestRooms,
      areas: nonGuestAreas,
    });

    const payload: WorkOrderInput = {
      subject: subject.trim(),
      description: description.trim() || null,
      priority,
      area_id: location.area_id,
      area_label: location.area_label,
      source_module: initialValues?.source_module ?? "Maintenance",
      source_record_id: initialValues?.source_record_id ?? null,
      source_note: initialValues?.source_note ?? null,
      created_by: createdBy || initialValues?.created_by || null,
    };

    const response = await fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(result.error || "Unable to create work order.");
      return;
    }

    onCreated?.();
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "640px",
          maxWidth: "100%",
          background: ONE_EYRIE.row,
          border: `1px solid ${ONE_EYRIE.border}`,
          borderRadius: "14px",
          padding: "22px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 6px", color: ONE_EYRIE.text, fontSize: "20px" }}>
          New Work Order
        </h2>
        <p style={{ margin: "0 0 18px", color: ONE_EYRIE.textMuted, fontSize: "13px" }}>
          Guest-impacting maintenance issue
          {initialValues?.source_module
            ? ` · from ${initialValues.source_module}`
            : ""}
        </p>

        {error && (
          <div
            style={{
              marginBottom: "14px",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #8B5252",
              color: "#C9A8A8",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label>
            <div style={fieldLabel}>Subject</div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={inputStyle}
              placeholder="Brief issue summary"
            />
          </label>

          <label>
            <div style={fieldLabel}>Room</div>
            <select
              value={selectedRoomId ?? ""}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : null;
                setSelectedRoomId(value);
                if (value) {
                  setSelectedAreaId(null);
                  setOtherLocation("");
                }
              }}
              disabled={areasLoading}
              style={{ ...inputStyle, height: "42px" }}
            >
              <option value="">Select room (optional)...</option>
              {guestRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Room {room.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={fieldLabel}>Area</div>
            <select
              value={selectedAreaId ?? ""}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : null;
                setSelectedAreaId(value);
                if (value) {
                  setSelectedRoomId(null);
                  setOtherLocation("");
                }
              }}
              disabled={areasLoading}
              style={{ ...inputStyle, height: "42px" }}
            >
              <option value="">Select area (optional)...</option>
              {groupedAreas.map((group) => (
                <optgroup key={group.key} label={group.label}>
                  {group.areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                      {area.area_type !== "Public Area"
                        ? ` · ${area.area_type}`
                        : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {showOtherLocation && (
            <label>
              <div style={fieldLabel}>Other location (optional)</div>
              <input
                value={otherLocation}
                onChange={(e) => setOtherLocation(e.target.value)}
                style={inputStyle}
                placeholder="Use only if room/area is not listed"
              />
            </label>
          )}

          <label>
            <div style={fieldLabel}>Priority</div>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
              style={{ ...inputStyle, height: "42px" }}
            >
              <option value="Normal">Normal</option>
              <option value="Important">Important</option>
              <option value="Urgent">Urgent</option>
            </select>
          </label>

          <label>
            <div style={fieldLabel}>Details</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: "vertical" }}
              placeholder="What needs to be fixed?"
            />
          </label>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            marginTop: "20px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              ...SETTINGS_BUTTON_BASE,
              background: "transparent",
              color: ONE_EYRIE.textMuted,
              border: `1px solid ${ONE_EYRIE.border}`,
              borderRadius: "12px",
              height: "44px",
              padding: "0 18px",
              fontWeight: 800,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving}
            style={{
              ...PRIMARY_BUTTON,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
            {...forestHoverHandlers(saving)}
          >
            {saving ? "Creating..." : "Create Work Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

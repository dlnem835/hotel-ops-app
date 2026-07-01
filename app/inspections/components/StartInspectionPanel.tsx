"use client";

import { useEffect, useMemo, useRef } from "react";
import { FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { templateMatchesDashboard } from "../lib/program-map";

export type TemplateOption = {
  id: number;
  name: string;
  inspection_program: string;
  standard_key?: string | null;
};

export type RoomOption = {
  id: number;
  name: string;
  status: string;
};

export type AssociateOption = {
  id: string;
  name: string;
};

export type StartInspectionFormProps = {
  program: "VR" | "RPM";
  rooms: RoomOption[];
  templates: TemplateOption[];
  associates: AssociateOption[];
  selectedRoomId: number | null;
  selectedTemplateId: number | null;
  selectedAssociateId: string | null;
  preloadedFromQueue?: boolean;
  onRoomChange: (id: number | null) => void;
  onTemplateChange: (id: number | null) => void;
  onAssociateChange: (id: string | null) => void;
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: "42px",
  borderRadius: "10px",
  padding: "0 12px",
  fontSize: "14px",
  fontWeight: 600,
  outline: "none",
  boxSizing: "border-box",
};

export function StartInspectionForm({
  program,
  rooms,
  templates,
  associates,
  selectedRoomId,
  selectedTemplateId,
  selectedAssociateId,
  preloadedFromQueue = false,
  onRoomChange,
  onTemplateChange,
  onAssociateChange,
}: StartInspectionFormProps) {
  const roomSelectRef = useRef<HTMLSelectElement>(null);

  const filteredTemplates = templates.filter((template) =>
    templateMatchesDashboard(template.inspection_program as never, program)
  );

  const roomOptions = useMemo(() => {
    const activeRooms = rooms.filter((room) => room.status === "Active");
    if (!selectedRoomId) {
      return activeRooms;
    }

    const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
    if (!selectedRoom || activeRooms.some((room) => room.id === selectedRoomId)) {
      return activeRooms;
    }

    return [selectedRoom, ...activeRooms];
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (!preloadedFromQueue || !selectedRoomId) {
      return;
    }

    roomSelectRef.current?.focus({ preventScroll: true });
  }, [preloadedFromQueue, selectedRoomId]);

  return (
    <div className="start-inspection-form">
      {preloadedFromQueue && selectedRoomId ? (
        <div className="start-inspection-form__hint">
          Room preloaded from Priority Queue — choose associate, then Start Inspection.
        </div>
      ) : null}

      <label className="start-inspection-form__field">
        <span className="start-inspection-form__label">Room</span>
        <select
          ref={roomSelectRef}
          value={selectedRoomId ?? ""}
          onChange={(event) =>
            onRoomChange(event.target.value ? Number(event.target.value) : null)
          }
          className="start-inspection-form__select"
          style={selectStyle}
        >
          <option value="">Select room...</option>
          {roomOptions.map((room) => (
            <option key={room.id} value={room.id}>
              Room {room.name}
              {room.status !== "Active" ? ` (${room.status})` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="start-inspection-form__field">
        <span className="start-inspection-form__label">Inspection Type</span>
        <select
          value={selectedTemplateId ?? ""}
          onChange={(event) =>
            onTemplateChange(event.target.value ? Number(event.target.value) : null)
          }
          className="start-inspection-form__select"
          style={selectStyle}
        >
          <option value="">Select template...</option>
          {filteredTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>

      <label className="start-inspection-form__field">
        <span className="start-inspection-form__label">Associate</span>
        <select
          value={selectedAssociateId ?? ""}
          onChange={(event) =>
            onAssociateChange(event.target.value ? event.target.value : null)
          }
          className="start-inspection-form__select"
          style={selectStyle}
        >
          <option value="">Optional...</option>
          {associates.map((associate) => (
            <option key={associate.id} value={associate.id}>
              {associate.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** @deprecated Desktop uses StartInspectionModal; kept for type exports and legacy layout. */
export default function StartInspectionPanel({
  program,
  rooms,
  templates,
  associates,
  selectedRoomId,
  selectedTemplateId,
  selectedAssociateId,
  highlighted = false,
  onRoomChange,
  onTemplateChange,
  onAssociateChange,
  onStart,
  starting,
}: StartInspectionFormProps & {
  highlighted?: boolean;
  onStart: () => void;
  starting?: boolean;
}) {
  const startDisabled = !selectedRoomId || !selectedTemplateId || starting;

  return (
    <div
      id="start-inspection-panel"
      style={{
        background: ONE_EYRIE.surface,
        border: `1px solid ${highlighted ? ONE_EYRIE.goldLight : ONE_EYRIE.gold}`,
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: highlighted
          ? `0 0 0 2px rgba(200, 169, 106, 0.35), 0 0 24px rgba(61, 107, 79, 0.25)`
          : `0 0 0 1px rgba(200, 169, 106, 0.08)`,
        transition: "box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease",
        transform: highlighted ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div
        style={{
          height: "4px",
          background: `linear-gradient(90deg, ${ONE_EYRIE.gold} 0%, ${ONE_EYRIE.goldLight} 50%, ${ONE_EYRIE.gold} 100%)`,
        }}
      />

      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
          Start Inspection
        </div>

        <StartInspectionForm
          program={program}
          rooms={rooms}
          templates={templates}
          associates={associates}
          selectedRoomId={selectedRoomId}
          selectedTemplateId={selectedTemplateId}
          selectedAssociateId={selectedAssociateId}
          preloadedFromQueue={highlighted}
          onRoomChange={onRoomChange}
          onTemplateChange={onTemplateChange}
          onAssociateChange={onAssociateChange}
        />

        <button
          type="button"
          onClick={onStart}
          disabled={startDisabled}
          style={{
            background: FOREST.bg,
            border: `1px solid ${FOREST.border}`,
            color: FOREST.text,
            borderRadius: "12px",
            height: "44px",
            fontWeight: 800,
            fontSize: "14px",
            opacity: startDisabled ? 0.55 : 1,
            cursor: startDisabled ? "not-allowed" : "pointer",
          }}
        >
          {starting ? "Starting..." : "Start Inspection"}
        </button>
      </div>
    </div>
  );
}

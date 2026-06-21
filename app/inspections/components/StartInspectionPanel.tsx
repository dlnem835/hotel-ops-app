"use client";

import { useEffect, useMemo, useRef } from "react";
import { FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { templateMatchesDashboard } from "../lib/program-map";
import {
  forestHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";

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

type StartInspectionPanelProps = {
  program: "VR" | "RPM";
  rooms: RoomOption[];
  templates: TemplateOption[];
  associates: AssociateOption[];
  selectedRoomId: number | null;
  selectedTemplateId: number | null;
  selectedAssociateId: string | null;
  highlighted?: boolean;
  onRoomChange: (id: number | null) => void;
  onTemplateChange: (id: number | null) => void;
  onAssociateChange: (id: string | null) => void;
  onStart: () => void;
  starting?: boolean;
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: "42px",
  background: ONE_EYRIE.black,
  color: ONE_EYRIE.text,
  border: `1px solid ${ONE_EYRIE.borderInput}`,
  borderRadius: "10px",
  padding: "0 12px",
  fontSize: "14px",
  fontWeight: 600,
  outline: "none",
};

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
}: StartInspectionPanelProps) {
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

  const startDisabled = !selectedRoomId || !selectedTemplateId || starting;

  useEffect(() => {
    if (!highlighted) {
      return;
    }

    roomSelectRef.current?.focus({ preventScroll: true });
  }, [highlighted, selectedRoomId]);

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

        {highlighted && selectedRoomId && (
          <div
            style={{
              color: FOREST.text,
              fontSize: "12px",
              fontWeight: 700,
              padding: "8px 10px",
              borderRadius: "8px",
              background: FOREST.bgSoft,
              border: `1px solid ${FOREST.border}`,
            }}
          >
            Room preloaded from Priority Queue — choose associate, then Start Inspection.
          </div>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", fontWeight: 700 }}>
            Room
          </span>
          <select
            ref={roomSelectRef}
            value={selectedRoomId ?? ""}
            onChange={(e) =>
              onRoomChange(e.target.value ? Number(e.target.value) : null)
            }
            style={{
              ...selectStyle,
              borderColor: highlighted ? FOREST.border : ONE_EYRIE.borderInput,
            }}
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

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", fontWeight: 700 }}>
            Inspection Type
          </span>
          <select
            value={selectedTemplateId ?? ""}
            onChange={(e) =>
              onTemplateChange(e.target.value ? Number(e.target.value) : null)
            }
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

        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", fontWeight: 700 }}>
            Associate
          </span>
          <select
            value={selectedAssociateId ?? ""}
            onChange={(e) =>
              onAssociateChange(e.target.value ? e.target.value : null)
            }
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

        <button
          type="button"
          onClick={onStart}
          disabled={startDisabled}
          style={{
            ...SETTINGS_BUTTON_BASE,
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
          {...forestHoverHandlers(startDisabled)}
        >
          {starting ? "Starting..." : "Start Inspection"}
        </button>
      </div>
    </div>
  );
}

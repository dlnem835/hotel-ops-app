"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { RoomGridTile } from "../lib/inspection-types";
import { formatScoreLabel } from "../lib/grid-state";
import { formatInspectionAgeLabel } from "../lib/inspection-age";
import { getGridTileStyle } from "../lib/grid-styles";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { SETTINGS_CARD_TRANSITION } from "@/app/settings/lib/settings-ui-interactions";

type InspectionRoomGridProps = {
  rooms: RoomGridTile[];
  onViewHistory?: (room: RoomGridTile) => void;
};

const LEGEND = [
  { label: "90%+", state: "strong" as const },
  { label: "80–89%", state: "watch" as const },
  { label: "<80%", state: "low" as const },
  { label: "Not inspected", state: "not_inspected" as const },
  { label: "Out of Service", state: "oos" as const },
];

function buildTooltipLines(room: RoomGridTile): string[] {
  const lines = [`Room ${room.name}`];

  lines.push(
    formatInspectionAgeLabel(
      room.neverInspectedForProgram,
      room.operationalLastCompletedAt
    )
  );

  if (room.neverInspectedInPeriod) {
    lines.push("Not inspected this period");
    return lines;
  }

  lines.push(`Score: ${formatScoreLabel(room.scorePercent)}`);
  lines.push(`Inspector: ${room.inspectorName || "—"}`);
  lines.push(`Associate: ${room.associateName || "—"}`);
  lines.push(`Type: ${room.inspectionType || "—"}`);

  return lines;
}

function buildTooltipLinesWithHistory(
  room: RoomGridTile,
  showHistoryHint: boolean
): string[] {
  const lines = buildTooltipLines(room);
  if (showHistoryHint) {
    lines.push("Click to view history");
  }
  return lines;
}

export default function InspectionRoomGrid({ rooms, onViewHistory }: InspectionRoomGridProps) {
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const filtered = useMemo(() => {
    if (!search.trim()) return rooms;
    const term = search.trim().toLowerCase();
    return rooms.filter((room) => room.name.toLowerCase().includes(term));
  }, [rooms, search]);

  const hoveredRoom = filtered.find((room) => room.areaId === hoveredId) || null;

  return (
    <div
      style={{
        background: ONE_EYRIE.surfaceInset,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "14px",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {LEGEND.map((item) => {
            const style = getGridTileStyle(item.state);
            return (
              <span
                key={item.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  color: ONE_EYRIE.textSubtle,
                  fontSize: "11px",
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    borderRadius: "3px",
                    border: `1px solid ${style.border}`,
                    background: style.background,
                  }}
                />
                {item.label}
              </span>
            );
          })}
        </div>

        <div style={{ position: "relative", minWidth: "180px" }}>
          <Search
            size={15}
            color={ONE_EYRIE.textSubtle}
            style={{ position: "absolute", left: 10, top: 10 }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search room..."
            className="one-eyrie-room-grid-search"
            style={{
              width: "100%",
              height: "36px",
              borderRadius: "10px",
              padding: "0 12px 0 32px",
              outline: "none",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
          gap: "6px",
        }}
      >
        {filtered.map((room) => {
          const style = getGridTileStyle(room.gridState);
          return (
            <div
              key={room.areaId}
              onClick={() => onViewHistory?.(room)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredId(room.areaId);
                setTooltipPos({
                  x: rect.left + rect.width / 2,
                  y: rect.top - 8,
                });
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 0 12px rgba(61,107,79,0.35)";
                e.currentTarget.style.borderColor = "#3D6B4F";
              }}
              onMouseLeave={(e) => {
                setHoveredId((current) => (current === room.areaId ? null : current));
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = style.border;
              }}
              style={{
                minHeight: "44px",
                border: `1px solid ${style.border}`,
                borderRadius: "7px",
                background: style.background,
                color: style.color,
                cursor: onViewHistory ? "pointer" : "default",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1px",
                padding: "4px 2px",
                transition: SETTINGS_CARD_TRANSITION,
              }}
            >
              <span style={{ fontWeight: 800, fontSize: "12px", lineHeight: 1.1 }}>
                {room.name}
              </span>
              <span style={{ fontSize: "10px", fontWeight: 700, opacity: 0.95 }}>
                {room.gridState === "oos"
                  ? "OOS"
                  : formatScoreLabel(room.scorePercent)}
              </span>
            </div>
          );
        })}
      </div>

      {hoveredRoom && (
        <div
          style={{
            position: "fixed",
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translate(-50%, -100%)",
            zIndex: 2000,
            pointerEvents: onViewHistory ? "auto" : "none",
            background: ONE_EYRIE.surface,
            border: `1px solid ${ONE_EYRIE.gold}`,
            borderRadius: "10px",
            padding: "10px 12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            minWidth: "200px",
            maxWidth: "280px",
          }}
        >
          {buildTooltipLinesWithHistory(hoveredRoom, Boolean(onViewHistory)).map((line, index) => (
            <div
              key={line}
              style={{
                color:
                  index === 0
                    ? ONE_EYRIE.gold
                    : line === "Click to view history"
                      ? "#B8D4C4"
                      : ONE_EYRIE.textMuted,
                fontSize: index === 0 ? "13px" : "12px",
                fontWeight: index === 0 ? 800 : 600,
                lineHeight: 1.45,
                marginTop: index === 0 ? 0 : "3px",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

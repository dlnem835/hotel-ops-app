"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { RoomHistoryEntry, RoomGridTile } from "../lib/inspection-types";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  goldHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";

type RoomHistoryDrawerProps = {
  open: boolean;
  room: RoomGridTile | null;
  history: RoomHistoryEntry[];
  loading: boolean;
  onClose: () => void;
  onStartInspection: (areaId: number) => void;
};

export default function RoomHistoryDrawer({
  open,
  room,
  history,
  loading,
  onClose,
  onStartInspection,
}: RoomHistoryDrawerProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!open || !room) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(460px, 100vw)",
          height: "100%",
          background: ONE_EYRIE.surface,
          borderLeft: `1px solid ${ONE_EYRIE.gold}`,
          padding: "24px",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "18px",
          }}
        >
          <div>
            <div style={{ color: ONE_EYRIE.text, fontWeight: 800, fontSize: "22px" }}>
              Room {room.name}
            </div>
            <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "13px", marginTop: "4px" }}>
              Inspection history
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              ...SETTINGS_BUTTON_BASE,
              background: "transparent",
              border: "none",
              color: ONE_EYRIE.text,
            }}
            {...goldHoverHandlers("icon")}
          >
            <X size={22} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onStartInspection(room.areaId)}
          style={{
            ...SETTINGS_BUTTON_BASE,
            width: "100%",
            background: FOREST.bg,
            border: `1px solid ${FOREST.border}`,
            color: FOREST.text,
            borderRadius: "12px",
            height: "42px",
            fontWeight: 800,
            marginBottom: "18px",
          }}
        >
          Start Inspection
        </button>

        {loading ? (
          <div style={{ color: ONE_EYRIE.textMuted }}>Loading history...</div>
        ) : history.length === 0 ? (
          <div style={{ color: ONE_EYRIE.textMuted, lineHeight: 1.6 }}>
            No completed inspections for this room yet.
          </div>
        ) : (
          history.map((entry) => {
            const expanded = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                style={{
                  border: `1px solid ${ONE_EYRIE.border}`,
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "10px",
                  background: ONE_EYRIE.surfacePanel,
                }}
              >
                <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "13px" }}>
                  {entry.template_name} · {entry.inspection_program}
                </div>
                <div
                  style={{
                    color: ONE_EYRIE.text,
                    fontWeight: 800,
                    fontSize: "20px",
                    marginTop: "8px",
                  }}
                >
                  {entry.score_percent === null ? "—" : `${Math.round(entry.score_percent)}%`}
                  <span
                    style={{
                      color: ONE_EYRIE.textSubtle,
                      fontSize: "12px",
                      fontWeight: 600,
                      marginLeft: "8px",
                    }}
                  >
                    {entry.earned_points}/{entry.possible_points} pts
                  </span>
                </div>
                <div
                  style={{
                    color: ONE_EYRIE.textMuted,
                    fontSize: "12px",
                    marginTop: "8px",
                    lineHeight: 1.5,
                  }}
                >
                  {new Date(entry.completed_at).toLocaleString()}
                  {entry.inspector_name && ` · Inspector: ${entry.inspector_name}`}
                  {entry.associate_name && ` · Associate: ${entry.associate_name}`}
                  {entry.failed_item_count > 0 &&
                    ` · ${entry.failed_item_count} failed item${
                      entry.failed_item_count === 1 ? "" : "s"
                    }`}
                </div>

                {entry.failedItems.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : entry.id)}
                      style={{
                        ...SETTINGS_BUTTON_BASE,
                        background: "transparent",
                        border: `1px solid ${FLAT_RED.border}`,
                        color: FLAT_RED.text,
                        borderRadius: "8px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {expanded ? "Hide" : "View"} failed items
                    </button>

                    {expanded && (
                      <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        {entry.failedItems.map((failedItem) => (
                          <div
                            key={`${failedItem.categoryKey}::${failedItem.itemKey}`}
                            style={{
                              border: `1px solid ${FLAT_RED.border}`,
                              borderRadius: "8px",
                              padding: "10px",
                              background: FLAT_RED.bg,
                            }}
                          >
                            <div style={{ color: ONE_EYRIE.text, fontWeight: 700, fontSize: "13px" }}>
                              {failedItem.label}
                            </div>
                            {failedItem.itemNotes && (
                              <div
                                style={{
                                  color: ONE_EYRIE.textSubtle,
                                  fontSize: "12px",
                                  marginTop: "6px",
                                  lineHeight: 1.45,
                                }}
                              >
                                {failedItem.itemNotes}
                              </div>
                            )}
                            {failedItem.photoUrl && (
                              <a
                                href={failedItem.photoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: "inline-block", marginTop: "8px" }}
                              >
                                <img
                                  src={failedItem.photoUrl}
                                  alt={`Photo for ${failedItem.label}`}
                                  style={{
                                    width: "72px",
                                    height: "72px",
                                    objectFit: "cover",
                                    borderRadius: "6px",
                                    border: `1px solid ${ONE_EYRIE.border}`,
                                  }}
                                />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Link
                  href={`/inspections/session/${entry.id}`}
                  style={{
                    display: "inline-block",
                    marginTop: "10px",
                    color: ONE_EYRIE.gold,
                    fontSize: "12px",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Open full inspection review →
                </Link>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

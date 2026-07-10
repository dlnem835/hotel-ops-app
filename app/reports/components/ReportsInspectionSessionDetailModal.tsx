"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import OutcomeBadge from "@/app/inspections/components/OutcomeBadge";
import { formatInspectionProgramLabel } from "@/app/reports/lib/inspection-report-filter-utils";
import type { InspectionProgram } from "@/app/inspections/lib/inspection-types";
import { formatInspectionScorePercent } from "@/app/inspections/lib/scoring";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import {
  resolveMemberDisplayLabel,
  useMemberDisplayNameResolver,
} from "@/app/lib/use-member-display-name";

type SessionResponse = {
  session: {
    id: number;
    area_id: number;
    inspection_program: InspectionProgram;
    completed_at: string | null;
    started_at: string;
    completed_by: string | null;
    inspector_id: string | null;
    associate_id: string | null;
    score_percent: number | null;
    earned_points: number;
    possible_points: number;
    failed_item_count: number;
    session_notes: string | null;
    template_snapshot: Record<string, unknown> | null;
  };
  responses: Array<{
    category_key: string;
    item_key: string;
    label_snapshot: { en?: string; es?: string };
    outcome: "pass" | "fail" | "na";
    item_notes: string | null;
    photo_url: string | null;
    sort_order: number;
  }>;
};

type ReportsInspectionSessionDetailModalProps = {
  sessionId: number;
  highlightItemKey?: string | null;
  onClose: () => void;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function templateNameFromSnapshot(snapshot: Record<string, unknown> | null | undefined): string {
  if (!snapshot || typeof snapshot !== "object") return "Inspection";
  const name = (snapshot as { name?: string }).name;
  return name?.trim() || "Inspection";
}

function itemLabel(labelSnapshot: { en?: string; es?: string } | undefined): string {
  return labelSnapshot?.en?.trim() || labelSnapshot?.es?.trim() || "Item";
}

export default function ReportsInspectionSessionDetailModal({
  sessionId,
  highlightItemKey,
  onClose,
}: ReportsInspectionSessionDetailModalProps) {
  const memberResolver = useMemberDisplayNameResolver();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionResponse | null>(null);
  const [roomName, setRoomName] = useState("—");

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/inspections/sessions/${sessionId}`);
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Unable to load inspection session.");
        }

        const payload = result as SessionResponse;
        if (cancelled) return;

        setDetail(payload);

        const { data: area } = await supabase
          .from("buildings_and_areas")
          .select("name")
          .eq("id", payload.session.area_id)
          .maybeSingle();

        if (!cancelled) {
          setRoomName(area?.name ? String(area.name) : "—");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load inspection session."
          );
          setDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const responsesByKey = useMemo(() => {
    const map = new Map<string, SessionResponse["responses"][number]>();
    for (const response of detail?.responses ?? []) {
      map.set(`${response.category_key}::${response.item_key}`, response);
    }
    return map;
  }, [detail]);

  const categories = useMemo(() => {
    const snapshot = detail?.session.template_snapshot;
    if (!snapshot || typeof snapshot !== "object") return [];
    const rawCategories = (snapshot as { categories?: Array<Record<string, unknown>> }).categories;
    return rawCategories ?? [];
  }, [detail]);

  const inspectorName = detail?.session.inspector_id
    ? resolveMemberDisplayLabel(memberResolver, detail.session.inspector_id)
    : detail?.session.completed_by;
  const associateName = detail?.session.associate_id
    ? resolveMemberDisplayLabel(memberResolver, detail.session.associate_id)
    : null;

  return (
    <div
      style={{ ...ONE_EYRIE_MODAL_OVERLAY, zIndex: 1200 }}
      role="presentation"
      onClick={onClose}
    >
      <div
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: "min(920px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-inspection-session-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <div>
            <h2
              id="reports-inspection-session-title"
              style={{ margin: 0, color: ONE_EYRIE.gold, fontSize: "20px", fontWeight: 800 }}
            >
              {templateNameFromSnapshot(detail?.session.template_snapshot ?? null)}
            </h2>
            <p style={{ margin: "6px 0 0", color: ONE_EYRIE.textSubtle, fontSize: "13px" }}>
              {roomName} · Completed inspection (read-only)
            </p>
          </div>
          <button
            type="button"
            style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
            onClick={onClose}
            aria-label="Close inspection session"
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: "18px 24px 24px" }}>
          {loading ? (
            <p style={{ margin: 0, color: ONE_EYRIE.textMuted }}>Loading inspection session…</p>
          ) : error ? (
            <p className="reports-all-work-orders__error" role="alert">
              {error}
            </p>
          ) : detail ? (
            <>
              <div
                style={{
                  display: "grid",
                  gap: "8px",
                  marginBottom: "16px",
                  color: ONE_EYRIE.text,
                  fontSize: "0.875rem",
                }}
              >
                <div>
                  Type:{" "}
                  {formatInspectionProgramLabel(detail.session.inspection_program)}
                </div>
                <div>
                  Score: {formatInspectionScorePercent(detail.session.score_percent)}
                </div>
                <div>Inspector: {inspectorName || "—"}</div>
                <div>Associate: {associateName || "—"}</div>
                <div>
                  Completed:{" "}
                  {detail.session.completed_at
                    ? new Date(detail.session.completed_at).toLocaleString()
                    : "—"}
                </div>
                <div>Failed items: {detail.session.failed_item_count}</div>
              </div>

              {categories.map((category) => {
                const categoryKey = String(category.key || "");
                const categoryLabel = String(category.label || categoryKey);
                const items = (category.items as Array<Record<string, unknown>> | undefined) ?? [];

                return (
                  <div key={categoryKey} style={{ marginBottom: "16px" }}>
                    <h3
                      style={{
                        margin: "0 0 8px",
                        color: ONE_EYRIE.gold,
                        fontSize: "0.875rem",
                        fontWeight: 800,
                      }}
                    >
                      {categoryLabel}
                    </h3>
                    {items.map((item) => {
                      const itemKey = String(item.key || "");
                      const response = responsesByKey.get(`${categoryKey}::${itemKey}`);
                      const isHighlighted = highlightItemKey === `${categoryKey}::${itemKey}`;

                      return (
                        <div
                          key={itemKey}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            padding: "10px 12px",
                            marginBottom: "6px",
                            borderRadius: "8px",
                            background: ONE_EYRIE.row,
                            border: isHighlighted
                              ? `2px solid ${ONE_EYRIE.gold}`
                              : `1px solid ${ONE_EYRIE.borderDivider}`,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: ONE_EYRIE.text }}>
                              {itemLabel(
                                item.label as { en?: string; es?: string } | undefined
                              ) || itemLabel(response?.label_snapshot)}
                            </div>
                            {response?.item_notes ? (
                              <div style={{ marginTop: "4px", color: ONE_EYRIE.textSubtle }}>
                                {response.item_notes}
                              </div>
                            ) : null}
                          </div>
                          {response ? <OutcomeBadge outcome={response.outcome} /> : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {detail.session.session_notes?.trim() ? (
                <div style={{ marginTop: "12px" }}>
                  <div
                    style={{
                      color: ONE_EYRIE.textSubtle,
                      fontSize: "12px",
                      fontWeight: 700,
                      marginBottom: "6px",
                    }}
                  >
                    Session notes
                  </div>
                  <p style={{ margin: 0, color: ONE_EYRIE.text, whiteSpace: "pre-wrap" }}>
                    {detail.session.session_notes}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

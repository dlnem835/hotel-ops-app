"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import CompletedInspectionReview from "@/app/inspections/components/CompletedInspectionReview";
import { formatInspectionDuration } from "@/app/inspections/lib/inspection-duration";
import type { InspectionProgram } from "@/app/inspections/lib/inspection-types";
import { formatInspectionProgramLabel } from "@/app/reports/lib/inspection-report-filter-utils";
import { PropertyTemplateContent } from "@/app/inspections/standards/types";
import { buildMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import "@/app/inspections/inspections-responsive.css";

type Outcome = "pass" | "fail" | "na";

type SessionResponse = {
  session: {
    id: number;
    area_id: number;
    inspection_program: InspectionProgram;
    status: string;
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
    outcome: Outcome;
    item_notes: string | null;
    photo_url: string | null;
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

function itemKey(categoryKey: string, itemKeyValue: string) {
  return `${categoryKey}::${itemKeyValue}`;
}

function normalizeHighlightItemKey(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  if (value.includes("::")) return value;
  return null;
}

export default function ReportsInspectionSessionDetailModal({
  sessionId,
  highlightItemKey,
  onClose,
}: ReportsInspectionSessionDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("—");
  const [templateName, setTemplateName] = useState("Inspection");
  const [content, setContent] = useState<PropertyTemplateContent | null>(null);
  const [program, setProgram] = useState("");
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [inspectorName, setInspectorName] = useState<string | null>(null);
  const [associateName, setAssociateName] = useState<string | null>(null);
  const [scorePercent, setScorePercent] = useState<number | null>(null);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [possiblePoints, setPossiblePoints] = useState(0);
  const [sessionNotes, setSessionNotes] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, Outcome | undefined>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [expandedCategoryKey, setExpandedCategoryKey] = useState<string | null>(null);

  const resolvedHighlightItemKey = normalizeHighlightItemKey(highlightItemKey);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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

        const snapshot = payload.session.template_snapshot as {
          name?: string;
          content?: PropertyTemplateContent;
        };

        setTemplateName(snapshot.name?.trim() || "Inspection");
        setContent(snapshot.content || null);
        setProgram(formatInspectionProgramLabel(payload.session.inspection_program));
        setCompletedAt(payload.session.completed_at);
        setStartedAt(payload.session.started_at);
        setScorePercent(
          payload.session.score_percent === null
            ? null
            : Number(payload.session.score_percent)
        );
        setEarnedPoints(Number(payload.session.earned_points) || 0);
        setPossiblePoints(Number(payload.session.possible_points) || 0);
        setSessionNotes(payload.session.session_notes?.trim() || null);

        const memberIds = [payload.session.inspector_id, payload.session.associate_id].filter(
          Boolean
        ) as string[];

        if (memberIds.length > 0) {
          const { data: members } = await supabase
            .from("team_members")
            .select("id, first_name, last_name, username")
            .in("id", memberIds);

          const nameById = buildMemberDisplayNameResolver(members || []);
          setInspectorName(
            payload.session.inspector_id
              ? nameById.displayForMemberId(payload.session.inspector_id) ||
                  payload.session.completed_by
              : payload.session.completed_by
          );
          setAssociateName(
            payload.session.associate_id
              ? nameById.displayForMemberId(payload.session.associate_id)
              : null
          );
        } else {
          setInspectorName(payload.session.completed_by);
          setAssociateName(null);
        }

        const initialResponses: Record<string, Outcome | undefined> = {};
        const initialNotes: Record<string, string> = {};
        const initialPhotos: Record<string, string> = {};

        for (const row of payload.responses || []) {
          const key = itemKey(row.category_key, row.item_key);
          initialResponses[key] = row.outcome;
          if (row.item_notes) initialNotes[key] = row.item_notes;
          if (row.photo_url) initialPhotos[key] = row.photo_url;
        }

        setResponses(initialResponses);
        setNotes(initialNotes);
        setPhotos(initialPhotos);

        const highlightCategoryKey = resolvedHighlightItemKey?.split("::")[0] ?? null;
        const firstCategoryKey = snapshot.content?.categories[0]?.key ?? null;
        setExpandedCategoryKey(highlightCategoryKey || firstCategoryKey);

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
          setContent(null);
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
  }, [sessionId, resolvedHighlightItemKey]);

  const durationLabel = useMemo(
    () => formatInspectionDuration(startedAt, completedAt),
    [startedAt, completedAt]
  );

  function toggleCategory(categoryKey: string) {
    setExpandedCategoryKey((current) => (current === categoryKey ? null : categoryKey));
  }

  return (
    <div
      role="presentation"
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(0, 0, 0, 0.72)",
        display: "flex",
        justifyContent: "center",
        alignItems: "stretch",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-inspection-session-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(1080px, 100%)",
          height: "100%",
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: "14px",
          overflow: "hidden",
          border: `1px solid ${ONE_EYRIE.border}`,
          background: ONE_EYRIE.black,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
        }}
      >
        {loading ? (
          <div style={{ padding: "32px", color: ONE_EYRIE.textMuted, overflowY: "auto" }}>
            Loading inspection…
          </div>
        ) : error ? (
          <div style={{ padding: "32px", overflowY: "auto" }}>
            <p className="reports-all-work-orders__error" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="reports-pm-results__source-link"
              onClick={handleClose}
              style={{ marginTop: "12px" }}
            >
              Back to Report
            </button>
          </div>
        ) : content ? (
          <section
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <CompletedInspectionReview
              roomName={roomName}
              templateName={templateName}
              program={program}
              completedAt={completedAt}
              startedAt={startedAt}
              durationLabel={durationLabel}
              inspectorName={inspectorName}
              associateName={associateName}
              scorePercent={scorePercent}
              earnedPoints={earnedPoints}
              possiblePoints={possiblePoints}
              sessionNotes={sessionNotes}
              content={content}
              responses={responses}
              notes={notes}
              photos={photos}
              isMobileLayout={false}
              expandedCategoryKey={expandedCategoryKey}
              onToggleCategory={toggleCategory}
              onBack={handleClose}
              backLabel="Back to Report"
              headerBadgeLabel="Read Only"
              highlightItemKey={resolvedHighlightItemKey}
              embeddedScrollLayout
              expandAllCategories
            />
          </section>
        ) : (
          <div style={{ padding: "32px", color: ONE_EYRIE.textMuted, overflowY: "auto" }}>
            Unable to display this completed inspection.
            <button
              type="button"
              className="reports-pm-results__source-link"
              onClick={handleClose}
              style={{ display: "block", marginTop: "12px" }}
            >
              Back to Report
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

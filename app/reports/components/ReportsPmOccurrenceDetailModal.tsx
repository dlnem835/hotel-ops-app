"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import PmChecklistItemRow from "@/app/maintenance/components/PmChecklistItemRow";
import PmSessionMetadata from "@/app/maintenance/components/PmSessionMetadata";
import { PM_FREQUENCY_LABELS, type PmChecklist, type PmStepOutcome } from "@/app/maintenance/lib/pm-types";
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

type PmOccurrenceDetailResponse = {
  templateName: string;
  checklist: PmChecklist;
  frequency: string;
  assignmentType?: "area_location" | "equipment_unit";
  areaId: number | null;
  areaName: string | null;
  assetLabel: string | null;
  occurrence: {
    status: "open" | "completed" | "missed";
    dueDate: string;
    sessionNotes?: string | null;
    createdBy?: string | null;
    lastSavedBy?: string | null;
    lastSavedAt?: string | null;
    completedBy?: string | null;
    completedAt?: string | null;
    responses?: {
      steps?: Array<{
        stepKey: string;
        outcome: PmStepOutcome;
        notes?: string;
        photoUrl?: string | null;
      }>;
      targetOutcome?: "complete" | "issue_found" | null;
    };
  };
};

type ReportsPmOccurrenceDetailModalProps = {
  occurrenceId: number;
  highlightStepKey?: string | null;
  onClose: () => void;
};

export default function ReportsPmOccurrenceDetailModal({
  occurrenceId,
  highlightStepKey,
  onClose,
}: ReportsPmOccurrenceDetailModalProps) {
  const memberResolver = useMemberDisplayNameResolver();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PmOccurrenceDetailResponse | null>(null);
  const highlightedStepRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/maintenance/pm-occurrences/${occurrenceId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load PM record.");
        }

        if (!cancelled) {
          setDetail(result as PmOccurrenceDetailResponse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load PM record."
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
  }, [occurrenceId]);

  useEffect(() => {
    if (!detail || !highlightStepKey || loading) return;

    window.requestAnimationFrame(() => {
      highlightedStepRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [detail, highlightStepKey, loading]);

  const allSteps = useMemo(() => {
    if (!detail?.checklist) return [];
    return detail.checklist.categories.flatMap((category) =>
      [...category.steps]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((step) => ({ ...step, categoryKey: category.key }))
    );
  }, [detail]);

  const responseByStepKey = useMemo(() => {
    const map = new Map<
      string,
      { outcome: PmStepOutcome; notes: string; photoUrl: string | null }
    >();

    for (const step of detail?.occurrence.responses?.steps ?? []) {
      map.set(step.stepKey, {
        outcome: step.outcome,
        notes: step.notes || "",
        photoUrl: step.photoUrl || null,
      });
    }

    return map;
  }, [detail]);

  const locationLabel =
    detail?.areaName && detail.assetLabel
      ? detail.assignmentType === "equipment_unit"
        ? `${detail.assetLabel} — ${detail.areaName}`
        : `${detail.areaName} · ${detail.assetLabel}`
      : detail?.areaName || detail?.assetLabel || "Property-wide";

  const frequencyLabel =
    PM_FREQUENCY_LABELS[detail?.frequency as keyof typeof PM_FREQUENCY_LABELS] ||
    detail?.frequency ||
    null;

  return (
    <div
      style={{ ...ONE_EYRIE_MODAL_OVERLAY, zIndex: 1200 }}
      role="presentation"
      onClick={onClose}
    >
      <div
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: "min(900px, 96vw)",
          maxHeight: "92vh",
          overflow: "auto",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-pm-occurrence-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <div>
            <h2
              id="reports-pm-occurrence-detail-title"
              style={{ margin: 0, color: ONE_EYRIE.gold, fontSize: "20px", fontWeight: 800 }}
            >
              {detail?.templateName || "PM record"}
            </h2>
            <p style={{ margin: "6px 0 0", color: ONE_EYRIE.textSubtle, fontSize: "13px" }}>
              Completed PM checklist and responses (read-only).
            </p>
          </div>
          <button
            type="button"
            style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
            onClick={onClose}
            aria-label="Close PM record"
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: "18px 24px 24px" }}>
          {loading ? (
            <p style={{ margin: 0, color: ONE_EYRIE.textMuted }}>Loading PM record…</p>
          ) : error ? (
            <p className="reports-all-work-orders__error" role="alert">
              {error}
            </p>
          ) : detail ? (
            <>
              <PmSessionMetadata
                locationLabel={locationLabel}
                frequencyLabel={frequencyLabel}
                createdByLabel={
                  detail.occurrence.createdBy
                    ? resolveMemberDisplayLabel(memberResolver, detail.occurrence.createdBy)
                    : null
                }
                savedByLabel={
                  detail.occurrence.lastSavedBy
                    ? resolveMemberDisplayLabel(memberResolver, detail.occurrence.lastSavedBy)
                    : null
                }
                savedAt={detail.occurrence.lastSavedAt || null}
                isCompleted={detail.occurrence.status === "completed"}
                completedByLabel={
                  detail.occurrence.completedBy
                    ? resolveMemberDisplayLabel(memberResolver, detail.occurrence.completedBy)
                    : null
                }
                completedAt={detail.occurrence.completedAt || null}
              />
              {detail.occurrence.responses?.targetOutcome ? (
                <div
                  style={{
                    display: "inline-flex",
                    marginTop: "10px",
                    padding: "5px 9px",
                    borderRadius: "999px",
                    border: `1px solid ${
                      detail.occurrence.responses.targetOutcome ===
                      "issue_found"
                        ? "#8A3B3B"
                        : "#2F6B4F"
                    }`,
                    color:
                      detail.occurrence.responses.targetOutcome ===
                      "issue_found"
                        ? "#F0A3A3"
                        : "#8FD3AE",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  Target result:{" "}
                  {detail.occurrence.responses.targetOutcome === "issue_found"
                    ? "Issue Found"
                    : "Complete"}
                </div>
              ) : null}

              {allSteps.length === 0 ? (
                <p style={{ margin: "16px 0 0", color: ONE_EYRIE.textMuted }}>
                  This PM has no checklist items.
                </p>
              ) : (
                <div style={{ marginTop: "16px" }}>
                  {allSteps.map((step, index) => {
                    const response = responseByStepKey.get(step.key);
                    const isHighlighted = highlightStepKey === step.key;

                    return (
                      <div
                        key={step.key}
                        ref={isHighlighted ? highlightedStepRef : undefined}
                        style={{
                          marginBottom: "10px",
                          borderRadius: "10px",
                          outline: isHighlighted
                            ? `2px solid ${ONE_EYRIE.gold}`
                            : undefined,
                        }}
                      >
                        <PmChecklistItemRow
                          step={step}
                          index={index}
                          outcome={response?.outcome || null}
                          notes={response?.notes || ""}
                          photoUrl={response?.photoUrl || null}
                          readOnly
                          onOutcomeChange={() => {}}
                          onNotesChange={() => {}}
                          onPhotoSelect={() => {}}
                          onPhotoRemove={() => {}}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {detail.occurrence.sessionNotes?.trim() ? (
                <div style={{ marginTop: "16px" }}>
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
                    {detail.occurrence.sessionNotes}
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

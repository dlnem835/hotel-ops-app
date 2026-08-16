"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AlertTriangle, Check, CheckCircle2 } from "lucide-react";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import PmChecklistItemRow from "../../components/PmChecklistItemRow";
import PmSessionMetadata from "../../components/PmSessionMetadata";
import WorkOrderModal, {
  type WorkOrderModalInitialValues,
} from "../../components/WorkOrderModal";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { APP_SHELL, MAIN_CONTENT } from "@/app/lib/oneEyrieLayout";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  GOLD_FILLED_BUTTON,
  GOLD_OUTLINE_ACTION_BUTTON,
  goldFilledHoverHandlers,
  goldHoverHandlers,
} from "@/app/settings/lib/settings-ui-interactions";
import type {
  PmOccurrenceResponses,
  PmTargetOutcome,
} from "../../lib/maintenance-types";
import type {
  PmProgramSession,
  PmProgramSessionTarget,
} from "../../lib/pm-program-session-db";
import type { PmStepOutcome } from "../../lib/pm-types";
import { PM_FREQUENCY_LABELS } from "../../lib/pm-types";
import { classifyWorkOrderItemIssue } from "../../lib/work-order-item-issues";
import {
  resolveMemberDisplayLabel,
  useMemberDisplayNameResolver,
} from "@/app/lib/use-member-display-name";
import "../../maintenance-responsive.css";
import "@/app/inspections/inspections-responsive.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ResponseMap = Record<string, PmStepOutcome | undefined>;

function targetLabel(
  target: PmProgramSessionTarget,
  isEquipment: boolean
): string {
  if (target.areaName && target.assetLabel) {
    return isEquipment
      ? `${target.assetLabel} — ${target.areaName}`
      : `${target.areaName} · ${target.assetLabel}`;
  }
  return target.assetLabel || target.areaName || "Property-wide";
}

export default function PmProgramPage() {
  const params = useParams<{ templateId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const templateId = Number(params.templateId);
  const fromMobile = searchParams.get("from") === "mobile";
  const returnPath = fromMobile ? "/mobile/pms" : "/maintenance";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PmProgramSession | null>(null);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploadingKeys, setUploadingKeys] = useState<Record<string, boolean>>({});
  const [targetOutcomes, setTargetOutcomes] = useState<
    Record<number, PmTargetOutcome | null>
  >({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderInitial, setWorkOrderInitial] = useState<
    WorkOrderModalInitialValues | undefined
  >(undefined);
  const memberResolver = useMemberDisplayNameResolver();

  function applySession(nextSession: PmProgramSession) {
    const nextResponses: ResponseMap = {};
    const nextNotes: Record<string, string> = {};
    const nextPhotos: Record<string, string> = {};
    for (const step of nextSession.responses?.steps || []) {
      nextResponses[step.stepKey] = step.outcome;
      if (step.notes) nextNotes[step.stepKey] = step.notes;
      if (step.photoUrl) nextPhotos[step.stepKey] = step.photoUrl;
    }
    setSession(nextSession);
    setResponses(nextResponses);
    setNotes(nextNotes);
    setPhotos(nextPhotos);
    setSessionNotes(nextSession.sessionNotes || "");
    setTargetOutcomes(
      Object.fromEntries(
        nextSession.targets.map((target) => [
          target.assignmentId,
          target.outcome,
        ])
      )
    );
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      if (!authSession) {
        window.location.href = "/login";
        return;
      }

      const { data: teamMember } = await supabase
        .from("team_members")
        .select("first_name, last_name, username")
        .eq("auth_user_id", authSession.user.id)
        .maybeSingle();
      if (mounted && teamMember) {
        setCurrentUserName(
          teamMember.username ||
            [teamMember.first_name, teamMember.last_name]
              .filter(Boolean)
              .join(" ") ||
            null
        );
      }

      const response = await tenantFetch(
        `/api/maintenance/pm-programs/${templateId}`,
        { method: "POST" }
      );
      const result = await response.json();
      if (!mounted) return;
      if (!response.ok) {
        setError(result.error || "Unable to open PM program");
      } else {
        applySession(result.session as PmProgramSession);
      }
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [templateId]);

  const allSteps = useMemo(
    () =>
      (session?.checklist.categories || []).flatMap((category) =>
        [...category.steps]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((step) => ({ ...step, categoryKey: category.key }))
      ),
    [session]
  );
  const sortedTargets = useMemo(() => {
    if (!session) return [];
    const equipment = session.assignmentType === "equipment_unit";
    return [...session.targets].sort((a, b) =>
      targetLabel(a, equipment).localeCompare(targetLabel(b, equipment))
    );
  }, [session]);
  const isCompleted = session?.status === "completed";
  const isEquipment = session?.assignmentType === "equipment_unit";
  const targetNoun = isEquipment ? "unit" : "location";
  const targetNounPlural = isEquipment ? "units" : "locations";
  const markedCount = sortedTargets.filter(
    (target) => Boolean(targetOutcomes[target.assignmentId])
  ).length;
  const requiredStepsAnswered = allSteps
    .filter((step) => step.required)
    .every((step) => Boolean(responses[step.key]));
  const allTargetsMarked =
    sortedTargets.length > 0 && markedCount === sortedTargets.length;
  const canComplete =
    requiredStepsAnswered &&
    allTargetsMarked &&
    !saving &&
    !Object.values(uploadingKeys).some(Boolean);

  function buildResponsesPayload(): PmOccurrenceResponses {
    return {
      steps: allSteps
        .filter((step) => responses[step.key])
        .map((step) => ({
          stepKey: step.key,
          outcome: responses[step.key] as PmStepOutcome,
          notes: responses[step.key] === "fail" ? notes[step.key] : undefined,
          photoUrl:
            responses[step.key] === "fail" ? photos[step.key] || null : null,
        })),
    };
  }

  async function saveProgram(complete: boolean) {
    if (complete && !canComplete) return;
    setSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await tenantFetch(
        `/api/maintenance/pm-programs/${templateId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            responses: buildResponsesPayload(),
            session_notes: sessionNotes,
            target_outcomes: targetOutcomes,
            status: complete ? "completed" : "open",
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to save PM progress");
      }
      applySession(result.session as PmProgramSession);
      if (complete) {
        router.push(returnPath);
      } else {
        setSaveMessage("Progress saved");
        window.setTimeout(() => setSaveMessage(null), 2500);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save PM progress"
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadItemPhoto(stepKey: string, file: File) {
    if (!session?.uploadOccurrenceId) return;
    setUploadingKeys((current) => ({ ...current, [stepKey]: true }));
    const formData = new FormData();
    formData.append("file", file);
    formData.append("stepKey", stepKey);
    const response = await tenantFetch(
      `/api/maintenance/pm-occurrences/${session.uploadOccurrenceId}/item-photo`,
      { method: "POST", body: formData }
    );
    setUploadingKeys((current) => ({ ...current, [stepKey]: false }));
    if (!response.ok) {
      setError("Unable to upload photo.");
      return;
    }
    const result = await response.json();
    setPhotos((current) => ({ ...current, [stepKey]: result.photoUrl }));
  }

  function markTarget(
    target: PmProgramSessionTarget,
    outcome: PmTargetOutcome
  ) {
    const nextOutcome =
      targetOutcomes[target.assignmentId] === outcome ? null : outcome;
    setTargetOutcomes((current) => ({
      ...current,
      [target.assignmentId]: nextOutcome,
    }));
    if (nextOutcome !== "issue_found") return;

    const label = targetLabel(target, Boolean(isEquipment));
    setWorkOrderInitial({
      subject: `PM issue: ${session?.templateName || "Preventive Maintenance"}`,
      description: "",
      item: classifyWorkOrderItemIssue({
        structuredItem: session?.templateName || "Preventive Maintenance",
      }),
      priority: "Important",
      area_id: target.areaId,
      area_label: label,
      source_module: "Maintenance",
      source_record_id: target.occurrenceId
        ? String(target.occurrenceId)
        : String(templateId),
      source_note: `${session?.templateName || "PM"} · Issue found at ${label}`,
      created_by: currentUserName,
    });
    setWorkOrderModalOpen(true);
  }

  const pageStyle = fromMobile
    ? {
        minHeight: "100vh",
        background: ONE_EYRIE.surface,
        color: ONE_EYRIE.text,
      }
    : APP_SHELL;

  return (
    <main style={pageStyle}>
      {!fromMobile ? <OneEyrieSidebar active="Maintenance" /> : null}
      <section
        style={
          fromMobile
            ? { padding: "20px 16px 36px" }
            : { ...MAIN_CONTENT, maxWidth: "960px" }
        }
      >
        <Link
          href={returnPath}
          style={{
            color: ONE_EYRIE.gold,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          ← Back to PMs
        </Link>

        {loading ? (
          <div style={{ color: ONE_EYRIE.textMuted, marginTop: "24px" }}>
            Loading PM…
          </div>
        ) : error && !session ? (
          <div style={{ color: FLAT_RED.text, marginTop: "24px" }}>{error}</div>
        ) : session ? (
          <>
            <header style={{ marginTop: "18px", marginBottom: "20px" }}>
              <h1
                style={{
                  color: ONE_EYRIE.text,
                  fontSize: fromMobile ? "24px" : "28px",
                  margin: "0 0 8px",
                }}
              >
                {session.templateName}
              </h1>
              <PmSessionMetadata
                locationLabel={`${session.targets.length} ${targetNounPlural}`}
                frequencyLabel={
                  PM_FREQUENCY_LABELS[
                    session.frequency as keyof typeof PM_FREQUENCY_LABELS
                  ] || session.frequency
                }
                createdByLabel={
                  session.createdBy
                    ? resolveMemberDisplayLabel(memberResolver, session.createdBy)
                    : null
                }
                savedByLabel={
                  session.savedBy
                    ? resolveMemberDisplayLabel(memberResolver, session.savedBy)
                    : null
                }
                savedAt={session.savedAt}
                isCompleted={isCompleted}
                completedByLabel={
                  session.completedBy
                    ? resolveMemberDisplayLabel(
                        memberResolver,
                        session.completedBy
                      )
                    : null
                }
                completedAt={session.completedAt}
              />
            </header>

            <div style={{ display: "grid", gap: "10px" }}>
              {allSteps.map((step, index) => (
                <PmChecklistItemRow
                  key={step.key}
                  step={step}
                  index={index}
                  outcome={responses[step.key] || null}
                  notes={notes[step.key] || ""}
                  photoUrl={photos[step.key] || null}
                  readOnly={isCompleted}
                  uploading={Boolean(uploadingKeys[step.key])}
                  onOutcomeChange={(outcome) =>
                    setResponses((current) => ({
                      ...current,
                      [step.key]: outcome,
                    }))
                  }
                  onNotesChange={(value) =>
                    setNotes((current) => ({ ...current, [step.key]: value }))
                  }
                  onPhotoSelect={(file) =>
                    void uploadItemPhoto(step.key, file)
                  }
                  onPhotoRemove={() =>
                    setPhotos((current) => {
                      const next = { ...current };
                      delete next[step.key];
                      return next;
                    })
                  }
                />
              ))}
            </div>

            <section
              style={{
                marginTop: "24px",
                paddingTop: "20px",
                borderTop: `1px solid ${ONE_EYRIE.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  alignItems: "baseline",
                  marginBottom: "12px",
                }}
              >
                <h2 style={{ color: ONE_EYRIE.text, margin: 0, fontSize: "20px" }}>
                  {isEquipment ? "Units" : "Locations"}
                </h2>
                <span
                  style={{
                    color: ONE_EYRIE.gold,
                    fontSize: "13px",
                    fontWeight: 800,
                  }}
                >
                  {markedCount} of {sortedTargets.length} {targetNounPlural} marked
                </span>
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                {sortedTargets.map((target) => {
                  const outcome = targetOutcomes[target.assignmentId] || null;
                  return (
                    <div
                      key={target.assignmentId}
                      style={{
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        padding: "12px 14px",
                        borderRadius: "10px",
                        border: `1px solid ${
                          outcome === "issue_found"
                            ? FLAT_RED.border
                            : outcome === "complete"
                              ? FOREST.border
                              : ONE_EYRIE.border
                        }`,
                        background: ONE_EYRIE.surfaceInset,
                      }}
                    >
                      <span style={{ color: ONE_EYRIE.text, fontWeight: 800 }}>
                        {targetLabel(target, Boolean(isEquipment))}
                      </span>
                      {isCompleted ? (
                        <span
                          style={{
                            color:
                              outcome === "issue_found"
                                ? FLAT_RED.text
                                : FOREST.text,
                            fontSize: "12px",
                            fontWeight: 800,
                          }}
                        >
                          {outcome === "issue_found"
                            ? "Issue Found"
                            : "Complete"}
                        </span>
                      ) : (
                        <span style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => markTarget(target, "complete")}
                            style={{
                              ...GOLD_OUTLINE_ACTION_BUTTON,
                              borderColor:
                                outcome === "complete"
                                  ? FOREST.border
                                  : ONE_EYRIE.gold,
                              color:
                                outcome === "complete"
                                  ? FOREST.text
                                  : ONE_EYRIE.gold,
                            }}
                            className="one-eyrie-btn one-eyrie-btn--gold-outline one-eyrie-btn--sm"
                          >
                            {outcome === "complete" ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <Check size={14} />
                            )}
                            Complete
                          </button>
                          <button
                            type="button"
                            onClick={() => markTarget(target, "issue_found")}
                            style={{
                              ...GOLD_OUTLINE_ACTION_BUTTON,
                              borderColor:
                                outcome === "issue_found"
                                  ? FLAT_RED.border
                                  : ONE_EYRIE.gold,
                              color:
                                outcome === "issue_found"
                                  ? FLAT_RED.text
                                  : ONE_EYRIE.gold,
                            }}
                            className="one-eyrie-btn one-eyrie-btn--gold-outline one-eyrie-btn--sm"
                          >
                            <AlertTriangle size={14} />
                            Issue Found
                          </button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {!isCompleted ? (
              <>
                <label style={{ display: "block", marginTop: "18px" }}>
                  <span
                    style={{
                      display: "block",
                      color: ONE_EYRIE.textSubtle,
                      fontSize: "12px",
                      fontWeight: 700,
                      marginBottom: "6px",
                    }}
                  >
                    Session notes
                  </span>
                  <textarea
                    value={sessionNotes}
                    onChange={(event) => setSessionNotes(event.target.value)}
                    rows={3}
                    className="one-eyrie-inspection-session-field"
                    style={{
                      width: "100%",
                      borderRadius: "10px",
                      padding: "12px",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </label>

                {error ? (
                  <div style={{ color: FLAT_RED.text, marginTop: "12px" }}>
                    {error}
                  </div>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    marginTop: "18px",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void saveProgram(false)}
                    disabled={saving}
                    style={{
                      ...GOLD_OUTLINE_ACTION_BUTTON,
                      opacity: saving ? 0.6 : 1,
                    }}
                    className="one-eyrie-btn one-eyrie-btn--gold-outline one-eyrie-btn--md"
                    {...goldHoverHandlers("secondary", saving)}
                  >
                    {saving ? "Saving…" : "Save Progress"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveProgram(true)}
                    disabled={!canComplete}
                    title={
                      canComplete
                        ? "Complete PM"
                        : `Answer required checklist items and mark every ${targetNoun}`
                    }
                    style={{
                      ...GOLD_FILLED_BUTTON,
                      opacity: canComplete ? 1 : 0.45,
                      cursor: canComplete ? "pointer" : "not-allowed",
                    }}
                    className="one-eyrie-btn one-eyrie-btn--gold-filled one-eyrie-btn--md"
                    {...goldFilledHoverHandlers(!canComplete)}
                  >
                    Complete PM
                  </button>
                  {saveMessage ? (
                    <span
                      style={{
                        color: ONE_EYRIE.textMuted,
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      {saveMessage}
                    </span>
                  ) : null}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </section>

      <WorkOrderModal
        open={workOrderModalOpen}
        initialValues={workOrderInitial}
        createdBy={currentUserName}
        onClose={() => setWorkOrderModalOpen(false)}
        onCreated={() => setWorkOrderModalOpen(false)}
      />
    </main>
  );
}

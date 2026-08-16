"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft } from "lucide-react";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import PmChecklistItemRow from "../../components/PmChecklistItemRow";
import PmSessionMetadata from "../../components/PmSessionMetadata";
import WorkOrderModal, {
  WorkOrderModalInitialValues,
} from "../../components/WorkOrderModal";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { APP_SHELL, MAIN_CONTENT } from "@/app/lib/oneEyrieLayout";
import { PmChecklist, PmStepOutcome, PM_FREQUENCY_LABELS } from "../../lib/pm-types";
import { PmOccurrenceResponses } from "../../lib/maintenance-types";
import {
  isMobilePmSession,
  pmSessionBackLabel,
  pmSessionReturnPath,
} from "../../lib/pm-session-return";
import {
  resolveMemberDisplayLabel,
  useMemberDisplayNameResolver,
} from "@/app/lib/use-member-display-name";
import {
  goldFilledHoverHandlers,
  goldHoverHandlers,
  GOLD_FILLED_BUTTON,
  GOLD_OUTLINE_ACTION_BUTTON,
} from "@/app/settings/lib/settings-ui-interactions";
import "@/app/inspections/inspections-responsive.css";
import "../../maintenance-responsive.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ResponseMap = Record<string, PmStepOutcome | undefined>;

export default function PmSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const occurrenceId = Number(params.id);
  const pmReturnPath = pmSessionReturnPath(searchParams);
  const pmBackLabel = pmSessionBackLabel(searchParams);
  const isMobileSession = isMobilePmSession(searchParams);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("PM");
  const [checklist, setChecklist] = useState<PmChecklist | null>(null);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploadingKeys, setUploadingKeys] = useState<Record<string, boolean>>({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [status, setStatus] = useState<"open" | "completed">("open");
  const [areaName, setAreaName] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<number | null>(null);
  const [assetLabel, setAssetLabel] = useState<string | null>(null);
  const [isEquipmentPm, setIsEquipmentPm] = useState(false);
  const [frequency, setFrequency] = useState("");
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [occurrenceCreatedBy, setOccurrenceCreatedBy] = useState<string | null>(null);
  const [occurrenceSavedBy, setOccurrenceSavedBy] = useState<string | null>(null);
  const [occurrenceSavedAt, setOccurrenceSavedAt] = useState<string | null>(null);
  const [occurrenceCompletedBy, setOccurrenceCompletedBy] = useState<string | null>(null);
  const [occurrenceCompletedAt, setOccurrenceCompletedAt] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderInitial, setWorkOrderInitial] = useState<
    WorkOrderModalInitialValues | undefined
  >(undefined);
  const memberResolver = useMemberDisplayNameResolver();

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: teamMember } = await supabase
        .from("team_members")
        .select("first_name, last_name, username")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (teamMember) {
        const displayName =
          teamMember.username ||
          [teamMember.first_name, teamMember.last_name].filter(Boolean).join(" ") ||
          null;
        setCurrentUserName(displayName);
      }

      const response = await tenantFetch(`/api/maintenance/pm-occurrences/${occurrenceId}`);
      const result = await response.json();
      setLoading(false);

      if (!response.ok) {
        alert(result.error || "Unable to load PM session");
        router.push(pmReturnPath);
        return;
      }

      setTemplateName(result.templateName || "PM");
      setChecklist(result.checklist || { categories: [] });
      setStatus(result.occurrence.status);
      setSessionNotes(result.occurrence.sessionNotes || "");
      setAreaName(result.areaName);
      setAreaId(result.areaId ?? null);
      setAssetLabel(result.assetLabel);
      setIsEquipmentPm(result.assignmentType === "equipment_unit");
      setFrequency(result.frequency || "");
      setOccurrenceCreatedBy(result.occurrence.createdBy || null);
      setOccurrenceSavedBy(result.occurrence.lastSavedBy || null);
      setOccurrenceSavedAt(result.occurrence.lastSavedAt || null);
      setOccurrenceCompletedBy(result.occurrence.completedBy || null);
      setOccurrenceCompletedAt(result.occurrence.completedAt || null);

      const nextResponses: ResponseMap = {};
      const nextNotes: Record<string, string> = {};
      const nextPhotos: Record<string, string> = {};

      for (const step of result.occurrence.responses?.steps || []) {
        nextResponses[step.stepKey] = step.outcome;
        if (step.notes) nextNotes[step.stepKey] = step.notes;
        if (step.photoUrl) nextPhotos[step.stepKey] = step.photoUrl;
      }

      setResponses(nextResponses);
      setNotes(nextNotes);
      setPhotos(nextPhotos);
    }

    void load();
  }, [occurrenceId, router, pmReturnPath]);

  const allSteps = useMemo(() => {
    if (!checklist) return [];
    return checklist.categories.flatMap((category) =>
      [...category.steps]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((step) => ({ ...step, categoryKey: category.key }))
    );
  }, [checklist]);

  const isCompleted = status === "completed";

  const workOrderContext = useMemo(
    () => ({
      templateName,
      occurrenceId,
      areaId,
      areaName,
      assetLabel,
      completedBy: currentUserName,
      onCreateWorkOrder: (initial: WorkOrderModalInitialValues) => {
        setWorkOrderInitial(initial);
        setWorkOrderModalOpen(true);
      },
    }),
    [
      templateName,
      occurrenceId,
      areaId,
      areaName,
      assetLabel,
      currentUserName,
    ]
  );

  function setOutcome(stepKey: string, outcome: PmStepOutcome | null) {
    setResponses((prev) => {
      const next = { ...prev };
      if (outcome) next[stepKey] = outcome;
      else delete next[stepKey];
      return next;
    });
  }

  async function uploadItemPhoto(stepKey: string, file: File) {
    setUploadingKeys((prev) => ({ ...prev, [stepKey]: true }));
    const formData = new FormData();
    formData.append("file", file);
    formData.append("stepKey", stepKey);

    const response = await tenantFetch(
      `/api/maintenance/pm-occurrences/${occurrenceId}/item-photo`,
      {
        method: "POST",
        body: formData,
      }
    );

    setUploadingKeys((prev) => ({ ...prev, [stepKey]: false }));

    if (!response.ok) {
      alert("Unable to upload photo.");
      return;
    }

    const result = await response.json();
    setPhotos((prev) => ({ ...prev, [stepKey]: result.photoUrl }));
  }

  function buildResponsesPayload(): PmOccurrenceResponses {
    const steps = allSteps
      .filter((step) => responses[step.key])
      .map((step) => ({
        stepKey: step.key,
        outcome: responses[step.key] as PmStepOutcome,
        notes: responses[step.key] === "fail" ? notes[step.key] : undefined,
        photoUrl: responses[step.key] === "fail" ? photos[step.key] || null : null,
      }));

    return { steps };
  }

  async function saveProgress() {
    setSaving(true);
    setSaveMessage(null);
    const response = await tenantFetch(`/api/maintenance/pm-occurrences/${occurrenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responses: buildResponsesPayload(),
        session_notes: sessionNotes,
        saved_by: currentUserName,
      }),
    });
    setSaving(false);

    if (!response.ok) {
      const result = await response.json();
      alert(result.error || "Unable to save PM progress");
      return;
    }

    const result = await response.json();
    setOccurrenceSavedBy(result.occurrence.lastSavedBy || null);
    setOccurrenceSavedAt(result.occurrence.lastSavedAt || null);

    setSaveMessage("Progress saved");
    window.setTimeout(() => setSaveMessage(null), 2500);
  }

  async function completePm() {
    const unanswered = allSteps.filter((step) => !responses[step.key]);
    if (unanswered.length > 0) {
      const proceed = window.confirm(
        `${unanswered.length} checklist item(s) are unanswered. Complete anyway?`
      );
      if (!proceed) return;
    }

    setSaving(true);
    const response = await tenantFetch(`/api/maintenance/pm-occurrences/${occurrenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responses: buildResponsesPayload(),
        session_notes: sessionNotes,
        status: "completed",
        completed_by: currentUserName,
      }),
    });
    setSaving(false);

    if (!response.ok) {
      const result = await response.json();
      alert(result.error || "Unable to complete PM");
      return;
    }

    router.push(pmReturnPath);
  }

  const locationLabel =
    areaName && assetLabel
      ? isEquipmentPm
        ? `${assetLabel} — ${areaName}`
        : `${areaName} · ${assetLabel}`
      : areaName || assetLabel || "Property-wide";

  const frequencyLabel =
    PM_FREQUENCY_LABELS[frequency as keyof typeof PM_FREQUENCY_LABELS] || frequency || null;

  return (
    <main
      className={isMobileSession ? "maintenance-pm-session--mobile" : undefined}
      style={
        isMobileSession
          ? {
              minHeight: "100vh",
              background: ONE_EYRIE.surface,
              color: ONE_EYRIE.text,
            }
          : APP_SHELL
      }
    >
      {!isMobileSession ? <OneEyrieSidebar active="Maintenance" /> : null}

      <section
        style={isMobileSession ? undefined : { ...MAIN_CONTENT, padding: 0 }}
        className={isMobileSession ? "maintenance-pm-session--mobile__inner" : undefined}
      >
        <div
          className="maintenance-mobile-session-header"
          style={
            isMobileSession
              ? undefined
              : {
                  padding: "22px 28px",
                  borderBottom: `1px solid ${ONE_EYRIE.border}`,
                }
          }
        >
          {isMobileSession ? (
            <Link href={pmReturnPath} className="one-eyrie-mobile-back">
              ← {pmBackLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => router.push(pmReturnPath)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "transparent",
                border: "none",
                color: ONE_EYRIE.gold,
                cursor: "pointer",
                fontWeight: 700,
                marginBottom: "10px",
                padding: 0,
              }}
            >
              <ArrowLeft size={16} />
              {pmBackLabel}
            </button>
          )}
          <h1
            className={isMobileSession ? "one-eyrie-mobile-page-title" : undefined}
            style={
              isMobileSession
                ? { margin: "0 0 8px" }
                : { margin: 0, color: ONE_EYRIE.text, fontSize: "22px" }
            }
          >
            {templateName}
          </h1>
          <PmSessionMetadata
            locationLabel={locationLabel}
            frequencyLabel={frequencyLabel}
            createdByLabel={
              occurrenceCreatedBy
                ? resolveMemberDisplayLabel(memberResolver, occurrenceCreatedBy)
                : null
            }
            savedByLabel={
              occurrenceSavedBy
                ? resolveMemberDisplayLabel(memberResolver, occurrenceSavedBy)
                : null
            }
            savedAt={occurrenceSavedAt}
            isCompleted={isCompleted}
            completedByLabel={
              occurrenceCompletedBy
                ? resolveMemberDisplayLabel(memberResolver, occurrenceCompletedBy)
                : null
            }
            completedAt={occurrenceCompletedAt}
          />
        </div>

        <div
          className="maintenance-mobile-session-body"
          style={
            isMobileSession
              ? undefined
              : { padding: "18px 28px 100px", maxWidth: "900px" }
          }
        >
          {loading ? (
            <div style={{ color: ONE_EYRIE.textMuted }}>Loading PM checklist...</div>
          ) : (
            <>
              {allSteps.length === 0 ? (
                <div style={{ color: ONE_EYRIE.textMuted, marginBottom: "16px" }}>
                  This PM template has no checklist items. Add notes and complete when done.
                </div>
              ) : (
                allSteps.map((step, index) => (
                  <div key={step.key} style={{ marginBottom: "10px" }}>
                    <PmChecklistItemRow
                      step={step}
                      index={index}
                      outcome={responses[step.key] || null}
                      notes={notes[step.key] || ""}
                      photoUrl={photos[step.key] || null}
                      readOnly={isCompleted}
                      uploading={Boolean(uploadingKeys[step.key])}
                      workOrderContext={workOrderContext}
                      onOutcomeChange={(outcome) => setOutcome(step.key, outcome)}
                      onNotesChange={(value) =>
                        setNotes((prev) => ({ ...prev, [step.key]: value }))
                      }
                      onPhotoSelect={(file) => void uploadItemPhoto(step.key, file)}
                      onPhotoRemove={() =>
                        setPhotos((prev) => {
                          const next = { ...prev };
                          delete next[step.key];
                          return next;
                        })
                      }
                    />
                  </div>
                ))
              )}

              {!isCompleted && (
                <label style={{ display: "block", marginTop: "12px" }}>
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
                  <textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    rows={3}
                    className="one-eyrie-inspection-session-field"
                    style={{
                      width: "100%",
                      borderRadius: "10px",
                      padding: "12px",
                      resize: "vertical",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </label>
              )}

              {!isCompleted && (
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
                    onClick={() => void saveProgress()}
                    disabled={saving}
                    style={{
                      ...GOLD_OUTLINE_ACTION_BUTTON,
                      opacity: saving ? 0.6 : 1,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                    className="one-eyrie-btn one-eyrie-btn--gold-outline one-eyrie-btn--md"
                    {...goldHoverHandlers("secondary", saving)}
                  >
                    {saving ? "Saving..." : "Save Progress"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void completePm()}
                    disabled={saving}
                    style={{
                      ...GOLD_FILLED_BUTTON,
                      opacity: saving ? 0.6 : 1,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                    className="one-eyrie-btn one-eyrie-btn--gold-filled one-eyrie-btn--md"
                    {...goldFilledHoverHandlers(saving)}
                  >
                    {saving ? "Saving..." : "Complete PM"}
                  </button>
                  {saveMessage && (
                    <span
                      style={{
                        color: ONE_EYRIE.textMuted,
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      {saveMessage}
                    </span>
                  )}
                </div>
              )}

            </>
          )}
        </div>
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

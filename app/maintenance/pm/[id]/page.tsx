"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft } from "lucide-react";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import PmChecklistItemRow from "../../components/PmChecklistItemRow";
import WorkOrderModal, {
  WorkOrderModalInitialValues,
} from "../../components/WorkOrderModal";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { APP_SHELL, MAIN_CONTENT } from "@/app/lib/oneEyrieLayout";
import { PmChecklist, PmStepOutcome, PM_FREQUENCY_LABELS } from "../../lib/pm-types";
import { PmOccurrenceResponses } from "../../lib/maintenance-types";
import {
  pmSessionBackLabel,
  pmSessionReturnPath,
} from "../../lib/pm-session-return";
import {
  resolveMemberDisplayLabel,
  useMemberDisplayNameResolver,
} from "@/app/lib/use-member-display-name";
import {
  forestHoverHandlers,
  goldHoverHandlers,
  PRIMARY_BUTTON,
  SETTINGS_BUTTON_BASE,
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
  const [dueDate, setDueDate] = useState("");
  const [frequency, setFrequency] = useState("");
  const [completedBy, setCompletedBy] = useState<string | null>(null);
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
        setCompletedBy(teamMember.username || null);
      }

      const response = await fetch(`/api/maintenance/pm-occurrences/${occurrenceId}`);
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
      setDueDate(result.occurrence.dueDate);
      setFrequency(result.frequency || "");

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
      completedBy,
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
      completedBy,
    ]
  );

  function setOutcome(stepKey: string, outcome: PmStepOutcome) {
    setResponses((prev) => ({ ...prev, [stepKey]: outcome }));
    if (outcome !== "fail") {
      setNotes((prev) => {
        const next = { ...prev };
        delete next[stepKey];
        return next;
      });
      setPhotos((prev) => {
        const next = { ...prev };
        delete next[stepKey];
        return next;
      });
    }
  }

  async function uploadItemPhoto(stepKey: string, file: File) {
    setUploadingKeys((prev) => ({ ...prev, [stepKey]: true }));
    const formData = new FormData();
    formData.append("file", file);
    formData.append("stepKey", stepKey);

    const response = await fetch(
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
    const response = await fetch(`/api/maintenance/pm-occurrences/${occurrenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responses: buildResponsesPayload(),
        session_notes: sessionNotes,
      }),
    });
    setSaving(false);

    if (!response.ok) {
      const result = await response.json();
      alert(result.error || "Unable to save PM progress");
      return;
    }

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
    const response = await fetch(`/api/maintenance/pm-occurrences/${occurrenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responses: buildResponsesPayload(),
        session_notes: sessionNotes,
        status: "completed",
        completed_by: completedBy,
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
      ? `${areaName} · ${assetLabel}`
      : areaName || assetLabel || "Property-wide";

  return (
    <main style={APP_SHELL}>
      <OneEyrieSidebar active="Maintenance" />

      <section style={{ ...MAIN_CONTENT, padding: 0 }}>
        <div
          className="maintenance-mobile-session-header"
          style={{
            padding: "22px 28px",
            borderBottom: `1px solid ${ONE_EYRIE.border}`,
          }}
        >
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
          <h1 style={{ margin: 0, color: ONE_EYRIE.text, fontSize: "22px" }}>
            {templateName}
          </h1>
          <div style={{ color: ONE_EYRIE.textMuted, fontSize: "13px", marginTop: "6px" }}>
            {locationLabel}
            {dueDate ? ` · due ${dueDate}` : ""}
            {frequency ? ` · ${PM_FREQUENCY_LABELS[frequency as keyof typeof PM_FREQUENCY_LABELS] || frequency}` : ""}
          </div>
        </div>

        <div
          className="maintenance-mobile-session-body"
          style={{ padding: "18px 28px 100px", maxWidth: "900px" }}
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
                      ...SETTINGS_BUTTON_BASE,
                      background: "transparent",
                      border: `1px solid ${ONE_EYRIE.gold}`,
                      color: ONE_EYRIE.gold,
                      borderRadius: "12px",
                      padding: "0 18px",
                      height: "44px",
                      fontWeight: 800,
                      opacity: saving ? 0.6 : 1,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                    {...goldHoverHandlers("secondary", saving)}
                  >
                    {saving ? "Saving..." : "Save Progress"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void completePm()}
                    disabled={saving}
                    style={{
                      ...PRIMARY_BUTTON,
                      opacity: saving ? 0.6 : 1,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                    {...forestHoverHandlers(saving)}
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

              {isCompleted && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: `1px solid ${ONE_EYRIE.border}`,
                    color: ONE_EYRIE.textMuted,
                    fontSize: "13px",
                  }}
                >
                  This PM was completed
                  {completedBy
                    ? ` by ${resolveMemberDisplayLabel(memberResolver, completedBy)}`
                    : ""}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <WorkOrderModal
        open={workOrderModalOpen}
        initialValues={workOrderInitial}
        createdBy={completedBy}
        onClose={() => setWorkOrderModalOpen(false)}
        onCreated={() => setWorkOrderModalOpen(false)}
      />
    </main>
  );
}

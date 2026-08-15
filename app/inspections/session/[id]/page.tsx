"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Check, Minus, X } from "lucide-react";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import CompletedInspectionReview from "../../components/CompletedInspectionReview";
import FailedItemDetails from "../../components/FailedItemDetails";
import InspectionCategorySection from "../../components/InspectionCategorySection";
import { FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { useIsMobileInspectionLayout } from "../../lib/use-inspection-breakpoint";
import "../../inspections-responsive.css";
import { buildMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import { calculateInspectionScore, formatInspectionScoreDisplay } from "../../lib/scoring";
import { ItemResponseInput } from "../../lib/inspection-types";
import { PropertyTemplateContent } from "../../standards/types";
import {
  goldFilledHoverHandlers,
  goldHoverHandlers,
  GOLD_FILLED_BUTTON,
  GOLD_OUTLINE_ACTION_BUTTON,
  SETTINGS_BUTTON_BASE,
} from "@/app/settings/lib/settings-ui-interactions";
import WorkOrderModal, {
  WorkOrderModalInitialValues,
} from "@/app/maintenance/components/WorkOrderModal";
import CreateWorkOrderButton from "@/app/maintenance/components/CreateWorkOrderButton";
import { classifyWorkOrderItemIssue } from "@/app/maintenance/lib/work-order-item-issues";
import {
  GeneralInspectionStandards,
  InspectionItemGuidanceHeading,
} from "../../components/InspectionGuidance";
import {
  getHousekeepingVacantReadyItemGuidance,
  isHousekeepingVacantReadyTemplate,
} from "../../lib/housekeeping-vacant-ready-ui";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Outcome = "pass" | "fail" | "na";

type ResponseMap = Record<string, Outcome | undefined>;

function itemKey(categoryKey: string, itemKeyValue: string) {
  return `${categoryKey}::${itemKeyValue}`;
}

export default function InspectionSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = Number(params.id);
  const fromHistory = searchParams.get("from") === "history";
  const historyRoomId = searchParams.get("roomId");
  const historyRoomName = searchParams.get("roomName");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("Inspection");
  const [templateStandardKey, setTemplateStandardKey] = useState<string | null>(null);
  const [content, setContent] = useState<PropertyTemplateContent | null>(null);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploadingKeys, setUploadingKeys] = useState<Record<string, boolean>>({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [status, setStatus] = useState<string>("in_progress");
  const [roomName, setRoomName] = useState("");
  const [areaId, setAreaId] = useState<number | null>(null);
  const [program, setProgram] = useState("");
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [inspectorName, setInspectorName] = useState<string | null>(null);
  const [associateName, setAssociateName] = useState<string | null>(null);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [possiblePoints, setPossiblePoints] = useState(0);
  const [scorePercent, setScorePercent] = useState<number | null>(null);
  const [completedScore, setCompletedScore] = useState<string | null>(null);
  const [expandedCategoryKey, setExpandedCategoryKey] = useState<string | null>(null);
  const [expandedGuidanceItemKey, setExpandedGuidanceItemKey] = useState<string | null>(null);
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderInitial, setWorkOrderInitial] = useState<
    WorkOrderModalInitialValues | undefined
  >(undefined);
  const isMobileLayout = useIsMobileInspectionLayout();

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const response = await tenantFetch(`/api/inspections/sessions/${sessionId}`);
      const result = await response.json();
      setLoading(false);

      if (!response.ok) {
        alert(result.error || "Unable to load inspection");
        router.push("/inspections");
        return;
      }

      const snapshot = result.session.template_snapshot as {
        name?: string;
        standard_key?: string | null;
        content?: PropertyTemplateContent;
      };

      setTemplateName(snapshot.name || "Inspection");
      setTemplateStandardKey(snapshot.standard_key || null);
      setContent(snapshot.content || null);
      setStatus(result.session.status);
      setSessionNotes(result.session.session_notes || "");
      setProgram(String(result.session.inspection_program || ""));
      setAreaId(Number(result.session.area_id) || null);
      setCompletedAt(result.session.completed_at || null);
      setEarnedPoints(Number(result.session.earned_points) || 0);
      setPossiblePoints(Number(result.session.possible_points) || 0);
      setScorePercent(
        result.session.score_percent === null
          ? null
          : Number(result.session.score_percent)
      );

      if (result.session.status === "completed" && result.session.score_percent !== null) {
        setCompletedScore(`${Math.round(Number(result.session.score_percent))}%`);
      }

      const memberIds = [
        result.session.inspector_id,
        result.session.associate_id,
      ].filter(Boolean) as string[];

      if (memberIds.length > 0) {
        const { data: members } = await supabase
          .from("team_members")
          .select("id, first_name, last_name, username")
          .in("id", memberIds);

        const nameById = buildMemberDisplayNameResolver(members || []);
        if (result.session.inspector_id) {
          setInspectorName(
            nameById.displayForMemberId(result.session.inspector_id) || null
          );
        }
        if (result.session.associate_id) {
          setAssociateName(
            nameById.displayForMemberId(result.session.associate_id) || null
          );
        }
      }

      const initial: ResponseMap = {};
      const initialNotes: Record<string, string> = {};
      const initialPhotos: Record<string, string> = {};
      for (const row of result.responses || []) {
        const key = itemKey(row.category_key, row.item_key);
        initial[key] = row.outcome;
        if (row.item_notes) initialNotes[key] = row.item_notes;
        if (row.photo_url) initialPhotos[key] = row.photo_url;
      }
      setResponses(initial);
      setNotes(initialNotes);
      setPhotos(initialPhotos);

      const areaRes = await tenantFetch("/api/buildings-areas");
      const areaJson = await areaRes.json();
      const area = (areaJson.areas || []).find(
        (entry: { id: number }) => Number(entry.id) === Number(result.session.area_id)
      );
      if (area) setRoomName(String(area.name));
    }

    if (sessionId) void load();
  }, [sessionId, router]);

  useEffect(() => {
    if (!content || expandedCategoryKey) {
      return;
    }
    setExpandedCategoryKey(content.categories[0]?.key ?? null);
  }, [content, expandedCategoryKey]);

  function toggleCategory(categoryKeyValue: string) {
    setExpandedCategoryKey((current) =>
      current === categoryKeyValue ? null : categoryKeyValue
    );
  }

  function countAnsweredInCategory(categoryKeyValue: string): number {
    if (!content) return 0;
    const category = content.categories.find((entry) => entry.key === categoryKeyValue);
    if (!category) return 0;
    return category.items.filter(
      (item) => responses[itemKey(categoryKeyValue, item.key)] !== undefined
    ).length;
  }

  const responseInputs = useMemo((): ItemResponseInput[] => {
    if (!content) return [];
    const list: ItemResponseInput[] = [];
    for (const category of content.categories) {
      for (const item of category.items) {
        const key = itemKey(category.key, item.key);
        const outcome = responses[key];
        if (!outcome) continue;
        list.push({
          categoryKey: category.key,
          itemKey: item.key,
          outcome,
          itemNotes: outcome === "fail" ? notes[key] : undefined,
          photoUrl: outcome === "fail" ? photos[key] || null : null,
        });
      }
    }
    return list;
  }, [content, responses, notes, photos]);

  const liveScore = useMemo(() => {
    if (!content) return null;
    const scored = [];
    for (const category of content.categories) {
      for (const item of category.items) {
        const outcome = responses[itemKey(category.key, item.key)];
        if (!outcome) continue;
        scored.push({
          itemKey: item.key,
          pointValue: Math.max(0, Number(item.pointValue) || 0),
          outcome,
        });
      }
    }
    return calculateInspectionScore(scored);
  }, [content, responses]);

  const scoreDisplay = liveScore ? formatInspectionScoreDisplay(liveScore) : null;
  const isCompleted = status === "completed";
  const showVacantReadyGuidance = isHousekeepingVacantReadyTemplate(
    templateStandardKey,
    templateName
  );

  const totalItems = content?.categories.reduce((sum, cat) => sum + cat.items.length, 0) ?? 0;
  const answeredItems = responseInputs.length;

  function setOutcome(categoryKeyValue: string, itemKeyValue: string, outcome: Outcome) {
    const key = itemKey(categoryKeyValue, itemKeyValue);
    setResponses((prev) => ({
      ...prev,
      [key]: outcome,
    }));

    if (isMobileLayout) {
      setExpandedCategoryKey(categoryKeyValue);
    }

    if (outcome !== "fail") {
      setNotes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setPhotos((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function uploadItemPhoto(
    categoryKeyValue: string,
    itemKeyValue: string,
    file: File
  ) {
    const key = itemKey(categoryKeyValue, itemKeyValue);
    setUploadingKeys((prev) => ({ ...prev, [key]: true }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("categoryKey", categoryKeyValue);
    formData.append("itemKey", itemKeyValue);

    const response = await tenantFetch(`/api/inspections/sessions/${sessionId}/item-photo`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    setUploadingKeys((prev) => ({ ...prev, [key]: false }));

    if (!response.ok) {
      alert(result.error || "Unable to upload photo");
      return;
    }

    setPhotos((prev) => ({ ...prev, [key]: result.photoUrl }));
  }

  async function saveProgress() {
    setSaving(true);
    const response = await tenantFetch(`/api/inspections/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        responses: responseInputs,
        sessionNotes,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const result = await response.json();
      alert(result.error || "Unable to save progress");
    }
  }

  async function completeInspection() {
    if (!content) return;

    for (const category of content.categories) {
      for (const item of category.items) {
        if (!item.required) continue;
        const outcome = responses[itemKey(category.key, item.key)];
        if (!outcome) {
          alert(`Please answer required item: ${item.label.en}`);
          return;
        }
      }
    }

    setSaving(true);
    const response = await tenantFetch(`/api/inspections/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        responses: responseInputs,
        sessionNotes,
        completedBy: inspectorName,
      }),
    });
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to complete inspection");
      return;
    }

    router.push("/inspections");
  }

  function handleReviewBack() {
    if (fromHistory && historyRoomId) {
      const roomQuery = historyRoomName
        ? `&roomName=${encodeURIComponent(historyRoomName)}`
        : "";
      router.push(`/inspections?historyRoom=${historyRoomId}${roomQuery}`);
      return;
    }
    router.push("/inspections");
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: ONE_EYRIE.black, color: ONE_EYRIE.text, padding: 40 }}>
        Loading inspection...
      </main>
    );
  }

  if (isCompleted && content) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: ONE_EYRIE.black,
          color: ONE_EYRIE.text,
          display: "flex",
        }}
      >
        <OneEyrieSidebar active="Inspections" />

        <section style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <CompletedInspectionReview
            roomName={roomName}
            templateName={templateName}
            program={program}
            completedAt={completedAt}
            inspectorName={inspectorName}
            associateName={associateName}
            scorePercent={scorePercent}
            earnedPoints={earnedPoints}
            possiblePoints={possiblePoints}
            sessionNotes={sessionNotes || null}
            content={content}
            responses={responses}
            notes={notes}
            photos={photos}
            isMobileLayout={isMobileLayout}
            expandedCategoryKey={expandedCategoryKey}
            onToggleCategory={toggleCategory}
            onBack={handleReviewBack}
            backLabel={
              fromHistory && historyRoomName
                ? `Back to Room ${historyRoomName} history`
                : fromHistory
                  ? "Back to inspection history"
                  : "Back to dashboard"
            }
          />
        </section>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: ONE_EYRIE.black,
        color: ONE_EYRIE.text,
        display: "flex",
      }}
    >
      <OneEyrieSidebar active="Inspections" />

      <section style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div
          className="inspection-mobile-session-header"
          style={{
            padding: "24px 32px",
            borderBottom: `1px solid ${ONE_EYRIE.border}`,
            background: ONE_EYRIE.surface,
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/inspections")}
            style={{
              ...SETTINGS_BUTTON_BASE,
              background: "transparent",
              border: "none",
              color: ONE_EYRIE.gold,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "12px",
              fontWeight: 700,
            }}
          >
            <ArrowLeft size={16} />
            Back to dashboard
          </button>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800 }}>
                Room {roomName || "—"} · {templateName}
              </h1>
              <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "13px", marginTop: "6px" }}>
                {answeredItems}/{totalItems} items answered
              </div>
            </div>
            {(isCompleted ? completedScore : scoreDisplay?.percentLabel) && (
              <div style={{ textAlign: "right" }}>
                <div style={{ color: FOREST.text, fontWeight: 800, fontSize: "28px" }}>
                  {isCompleted ? completedScore : scoreDisplay?.percentLabel}
                </div>
                {!isCompleted && scoreDisplay && (
                  <div style={{ color: ONE_EYRIE.textMuted, fontSize: "12px" }}>
                    {scoreDisplay.pointsLabel}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className="inspection-mobile-session-body"
          style={{ flex: 1, overflowY: "auto", padding: "24px 32px 120px" }}
        >
          {showVacantReadyGuidance ? <GeneralInspectionStandards /> : null}

          {content?.categories.map((category) => (
            <InspectionCategorySection
              key={category.key}
              categoryKey={category.key}
              title={category.name.en}
              answeredCount={countAnsweredInCategory(category.key)}
              totalCount={category.items.length}
              expanded={expandedCategoryKey === category.key}
              onToggle={() => toggleCategory(category.key)}
            >
              {category.items.map((item, index) => {
                const key = itemKey(category.key, item.key);
                const outcome = responses[key];
                const guidance = showVacantReadyGuidance
                  ? getHousekeepingVacantReadyItemGuidance(category.key, item.key)
                  : null;
                return (
                  <div key={item.key} style={{ marginBottom: "8px" }}>
                    <div
                      className={isMobileLayout ? "inspection-mobile-item-card" : undefined}
                      style={{
                        padding: "12px",
                        borderRadius: "8px",
                        background: index % 2 === 0 ? ONE_EYRIE.row : ONE_EYRIE.surfaceInset,
                        border: `1px solid ${
                          outcome === "fail" ? "#8B5252" : ONE_EYRIE.borderDivider
                        }`,
                      }}
                    >
                      <div
                        className={isMobileLayout ? "inspection-mobile-item-row" : undefined}
                        style={{
                          display: "flex",
                          gap: "12px",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                        }}
                      >
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <div
                          className={isMobileLayout ? "inspection-mobile-item-label" : undefined}
                          style={{ fontWeight: 700, lineHeight: 1.45 }}
                        >
                          {guidance ? (
                            <InspectionItemGuidanceHeading
                              label={guidance.label}
                              inspect={guidance.inspect}
                              expanded={expandedGuidanceItemKey === key}
                              onToggle={() =>
                                setExpandedGuidanceItemKey((current) =>
                                  current === key ? null : key
                                )
                              }
                            />
                          ) : (
                            item.label.en
                          )}
                        </div>
                        <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "4px" }}>
                          Weight {item.pointValue}
                          {item.required ? " · Required" : ""}
                        </div>
                      </div>

                      {!isCompleted && (
                        <div
                          className={isMobileLayout ? "inspection-mobile-outcome-row" : undefined}
                          style={{ display: "flex", gap: "6px" }}
                        >
                          {([
                            ["pass", "Pass", Check, FOREST],
                            ["fail", "Fail", X, { border: "#8B5252", bg: "#1E1414", text: "#C9A8A8" }],
                            ["na", "N/A", Minus, { border: "#5A5A5A", bg: "#242424", text: "#9CA3AF" }],
                          ] as const).map(([value, label, Icon, palette]) => {
                            const active = outcome === value;
                            const colors =
                              value === "pass"
                                ? { border: FOREST.border, bg: FOREST.bg, text: FOREST.text }
                                : palette;
                            return (
                              <button
                                key={value}
                                type="button"
                                className={isMobileLayout ? "inspection-mobile-outcome-btn" : undefined}
                                onClick={() => setOutcome(category.key, item.key, value)}
                                style={{
                                  ...SETTINGS_BUTTON_BASE,
                                  minWidth: "64px",
                                  height: "36px",
                                  borderRadius: "8px",
                                  border: `1px solid ${active ? ONE_EYRIE.gold : colors.border}`,
                                  background: active ? colors.bg : "transparent",
                                  color: active ? colors.text : ONE_EYRIE.textSubtle,
                                  fontWeight: 800,
                                  fontSize: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "4px",
                                }}
                              >
                                <Icon size={14} />
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {isCompleted && outcome && (
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: "12px",
                            color:
                              outcome === "pass"
                                ? FOREST.text
                                : outcome === "fail"
                                  ? "#C9A8A8"
                                  : ONE_EYRIE.textSubtle,
                            textTransform: "uppercase",
                          }}
                        >
                          {outcome === "na" ? "N/A" : outcome}
                        </div>
                      )}
                    </div>
                    </div>

                    {outcome === "fail" && (
                      <>
                        <FailedItemDetails
                          notes={notes[key] || ""}
                          photoUrl={photos[key] || null}
                          readOnly={isCompleted}
                          uploading={Boolean(uploadingKeys[key])}
                          onNotesChange={(value) =>
                            setNotes((prev) => ({ ...prev, [key]: value }))
                          }
                          onPhotoSelect={(file) =>
                            void uploadItemPhoto(category.key, item.key, file)
                          }
                          onPhotoRemove={() =>
                            setPhotos((prev) => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            })
                          }
                        />
                        {!isCompleted && (
                          <div style={{ marginTop: "10px" }}>
                            <CreateWorkOrderButton
                              compact
                              onOpen={(initial) => {
                                setWorkOrderInitial(initial);
                                setWorkOrderModalOpen(true);
                              }}
                              initialValues={{
                                subject: "",
                                description: "",
                                item: classifyWorkOrderItemIssue({
                                  structuredItem: item.label.en,
                                  description: notes[key],
                                }),
                                priority: "Important",
                                area_id: areaId,
                                area_label: roomName ? `Room ${roomName}` : null,
                                source_module:
                                  program === "RPM"
                                    ? "RPM Inspection"
                                    : "Room Inspection",
                                source_record_id: String(sessionId),
                                source_note: `${templateName} · ${category.name.en} · ${item.label.en}${
                                  notes[key] ? ` — ${notes[key]}` : ""
                                }`,
                                photo_url: photos[key] || null,
                                created_by: inspectorName,
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </InspectionCategorySection>
          ))}

          {!isCompleted && (
            <label style={{ display: "block", marginTop: "8px" }}>
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

          {isCompleted && sessionNotes && (
            <div style={{ marginTop: "8px" }}>
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
              <div
                style={{
                  color: ONE_EYRIE.text,
                  fontSize: "13px",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  padding: "12px",
                  borderRadius: "10px",
                  border: `1px solid ${ONE_EYRIE.border}`,
                  background: ONE_EYRIE.surfacePanel,
                }}
              >
                {sessionNotes}
              </div>
            </div>
          )}
        </div>

        {!isCompleted && (
          <div
            className="inspection-mobile-session-actions"
            style={{
              position: "sticky",
              bottom: 0,
              padding: "16px 32px",
              borderTop: `1px solid ${ONE_EYRIE.border}`,
              background: ONE_EYRIE.surfacePanel,
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
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
              Save Progress
            </button>
            <button
              type="button"
              onClick={() => void completeInspection()}
              disabled={saving}
              style={{
                ...GOLD_FILLED_BUTTON,
                opacity: saving ? 0.6 : 1,
                cursor: saving ? "not-allowed" : "pointer",
              }}
              className="one-eyrie-btn one-eyrie-btn--gold-filled one-eyrie-btn--md"
              {...goldFilledHoverHandlers(saving)}
            >
              {saving ? "Submitting..." : "Complete Inspection"}
            </button>
          </div>
        )}
      </section>

      <WorkOrderModal
        open={workOrderModalOpen}
        initialValues={workOrderInitial}
        createdBy={inspectorName}
        onClose={() => setWorkOrderModalOpen(false)}
        onCreated={() => setWorkOrderModalOpen(false)}
      />
    </main>
  );
}

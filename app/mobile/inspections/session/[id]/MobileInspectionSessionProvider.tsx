"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/app/supabaseClient";
import { ItemResponseInput } from "@/app/inspections/lib/inspection-types";
import {
  mobileInspectionListHref,
  mobileInspectionListLabel,
} from "@/app/mobile/inspections/lib/inspection-shared";
import {
  calculateInspectionScore,
  formatInspectionScoreDisplay,
} from "@/app/inspections/lib/scoring";
import { PropertyTemplateContent } from "@/app/inspections/standards/types";

type Outcome = "pass" | "fail" | "na";
type ResponseMap = Record<string, Outcome | undefined>;

export function itemResponseKey(categoryKey: string, itemKeyValue: string) {
  return `${categoryKey}::${itemKeyValue}`;
}

type MobileInspectionSessionContextValue = {
  loading: boolean;
  saving: boolean;
  sessionId: number;
  status: string;
  roomName: string;
  templateName: string;
  program: string;
  associateName: string | null;
  inspectorName: string | null;
  areaId: number | null;
  content: PropertyTemplateContent | null;
  responses: ResponseMap;
  notes: Record<string, string>;
  photos: Record<string, string>;
  uploadingKeys: Record<string, boolean>;
  sessionNotes: string;
  setSessionNotes: (value: string) => void;
  answeredItems: number;
  totalItems: number;
  scoreLabel: string | null;
  scorePointsLabel: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  earnedPoints: number;
  possiblePoints: number;
  scorePercent: number | null;
  countAnsweredInCategory: (categoryKey: string) => number;
  categoryProgress: (categoryKey: string) => { answered: number; total: number; complete: boolean };
  setOutcome: (categoryKey: string, itemKey: string, outcome: Outcome) => void;
  setItemNotes: (categoryKey: string, itemKey: string, value: string) => void;
  uploadItemPhoto: (categoryKey: string, itemKey: string, file: File) => Promise<void>;
  removeItemPhoto: (categoryKey: string, itemKey: string) => void;
  saveProgress: () => Promise<boolean>;
  completeInspection: () => Promise<boolean>;
  listHref: string;
  listLabel: string;
};

const MobileInspectionSessionContext =
  createContext<MobileInspectionSessionContextValue | null>(null);

export function useMobileInspectionSession() {
  const context = useContext(MobileInspectionSessionContext);
  if (!context) {
    throw new Error("useMobileInspectionSession must be used within MobileInspectionSessionProvider");
  }
  return context;
}

export function MobileInspectionSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("Inspection");
  const [content, setContent] = useState<PropertyTemplateContent | null>(null);
  const [responses, setResponses] = useState<ResponseMap>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [uploadingKeys, setUploadingKeys] = useState<Record<string, boolean>>({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [status, setStatus] = useState("in_progress");
  const [roomName, setRoomName] = useState("");
  const [areaId, setAreaId] = useState<number | null>(null);
  const [program, setProgram] = useState("");
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [inspectorName, setInspectorName] = useState<string | null>(null);
  const [associateName, setAssociateName] = useState<string | null>(null);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [possiblePoints, setPossiblePoints] = useState(0);
  const [scorePercent, setScorePercent] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const returnPath =
          typeof window !== "undefined" ? window.location.pathname : "/mobile/inspections";
        window.location.href = `/login?next=${encodeURIComponent(returnPath)}`;
        return;
      }

      const response = await fetch(`/api/inspections/sessions/${sessionId}`);
      const result = await response.json();
      setLoading(false);

      if (!response.ok) {
        alert(result.error || "Unable to load inspection");
        const programHint = String(result.session?.inspection_program || "");
        router.push(mobileInspectionListHref(programHint));
        return;
      }

      const snapshot = result.session.template_snapshot as {
        name?: string;
        content?: PropertyTemplateContent;
      };

      setTemplateName(snapshot.name || "Inspection");
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

      const memberIds = [result.session.inspector_id, result.session.associate_id].filter(
        Boolean
      ) as string[];

      if (memberIds.length > 0) {
        const { data: members } = await supabase
          .from("team_members")
          .select("id, first_name, last_name, username")
          .in("id", memberIds);

        const nameById = new Map<string, string>();
        for (const member of members || []) {
          nameById.set(
            String(member.id),
            member.username ||
              `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
              "Unknown"
          );
        }

        if (result.session.inspector_id) {
          setInspectorName(nameById.get(String(result.session.inspector_id)) || null);
        }
        if (result.session.associate_id) {
          setAssociateName(nameById.get(String(result.session.associate_id)) || null);
        }
      }

      const initial: ResponseMap = {};
      const initialNotes: Record<string, string> = {};
      const initialPhotos: Record<string, string> = {};
      for (const row of result.responses || []) {
        const key = itemResponseKey(row.category_key, row.item_key);
        initial[key] = row.outcome;
        if (row.item_notes) initialNotes[key] = row.item_notes;
        if (row.photo_url) initialPhotos[key] = row.photo_url;
      }
      setResponses(initial);
      setNotes(initialNotes);
      setPhotos(initialPhotos);

      const areaRes = await fetch("/api/buildings-areas");
      const areaJson = await areaRes.json();
      const area = (areaJson.areas || []).find(
        (entry: { id: number }) => Number(entry.id) === Number(result.session.area_id)
      );
      if (area) setRoomName(String(area.name));
    }

    if (sessionId) void load();
  }, [sessionId, router]);

  const responseInputs = useMemo((): ItemResponseInput[] => {
    if (!content) return [];
    const list: ItemResponseInput[] = [];
    for (const category of content.categories) {
      for (const item of category.items) {
        const key = itemResponseKey(category.key, item.key);
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
        const outcome = responses[itemResponseKey(category.key, item.key)];
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

  const listHref = useMemo(() => mobileInspectionListHref(program), [program]);
  const listLabel = useMemo(() => mobileInspectionListLabel(program), [program]);
  const totalItems = content?.categories.reduce((sum, cat) => sum + cat.items.length, 0) ?? 0;
  const answeredItems = responseInputs.length;

  const countAnsweredInCategory = useCallback(
    (categoryKeyValue: string) => {
      if (!content) return 0;
      const category = content.categories.find((entry) => entry.key === categoryKeyValue);
      if (!category) return 0;
      return category.items.filter(
        (item) => responses[itemResponseKey(categoryKeyValue, item.key)] !== undefined
      ).length;
    },
    [content, responses]
  );

  const categoryProgress = useCallback(
    (categoryKeyValue: string) => {
      const total = content?.categories.find((entry) => entry.key === categoryKeyValue)?.items
        .length ?? 0;
      const answered = countAnsweredInCategory(categoryKeyValue);
      return {
        answered,
        total,
        complete: total > 0 && answered === total,
      };
    },
    [content, countAnsweredInCategory]
  );

  function setOutcome(categoryKeyValue: string, itemKeyValue: string, outcome: Outcome) {
    const key = itemResponseKey(categoryKeyValue, itemKeyValue);
    setResponses((prev) => ({ ...prev, [key]: outcome }));

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
    const key = itemResponseKey(categoryKeyValue, itemKeyValue);
    setUploadingKeys((prev) => ({ ...prev, [key]: true }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("categoryKey", categoryKeyValue);
    formData.append("itemKey", itemKeyValue);

    const response = await fetch(`/api/inspections/sessions/${sessionId}/item-photo`, {
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

  function removeItemPhoto(categoryKeyValue: string, itemKeyValue: string) {
    const key = itemResponseKey(categoryKeyValue, itemKeyValue);
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setItemNotes(categoryKeyValue: string, itemKeyValue: string, value: string) {
    const key = itemResponseKey(categoryKeyValue, itemKeyValue);
    setNotes((prev) => ({ ...prev, [key]: value }));
  }

  async function saveProgress() {
    setSaving(true);
    const response = await fetch(`/api/inspections/sessions/${sessionId}`, {
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
      return false;
    }
    return true;
  }

  async function completeInspection() {
    if (!content) return false;

    for (const category of content.categories) {
      for (const item of category.items) {
        if (!item.required) continue;
        const outcome = responses[itemResponseKey(category.key, item.key)];
        if (!outcome) {
          alert(`Please answer required item: ${item.label.en}`);
          return false;
        }
      }
    }

    setSaving(true);
    const response = await fetch(`/api/inspections/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        responses: responseInputs,
        sessionNotes,
      }),
    });
    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      alert(result.error || "Unable to complete inspection");
      return false;
    }

    setStatus("completed");
    setCompletedAt(result.session?.completed_at || new Date().toISOString());
    if (result.session?.score_percent !== undefined && result.session?.score_percent !== null) {
      setScorePercent(Number(result.session.score_percent));
    }
    return true;
  }

  const value: MobileInspectionSessionContextValue = {
    loading,
    saving,
    sessionId,
    status,
    roomName,
    templateName,
    program,
    associateName,
    inspectorName,
    areaId,
    content,
    responses,
    notes,
    photos,
    uploadingKeys,
    sessionNotes,
    setSessionNotes,
    answeredItems,
    totalItems,
    scoreLabel: isCompleted && scorePercent !== null
      ? `${Math.round(scorePercent)}%`
      : scoreDisplay?.percentLabel ?? null,
    scorePointsLabel: scoreDisplay?.pointsLabel ?? null,
    isCompleted,
    completedAt,
    earnedPoints,
    possiblePoints,
    scorePercent,
    countAnsweredInCategory,
    categoryProgress,
    setOutcome,
    setItemNotes,
    uploadItemPhoto,
    removeItemPhoto,
    saveProgress,
    completeInspection,
    listHref,
    listLabel,
  };

  return (
    <MobileInspectionSessionContext.Provider value={value}>
      {children}
    </MobileInspectionSessionContext.Provider>
  );
}

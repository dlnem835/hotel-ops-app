"use client";

import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  Search,
  Trash2,
  Edit2,
  Eye,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Calendar,
  SlidersHorizontal,
  Send,
} from "lucide-react";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import OneEyrieDesktopHeaderActions from "@/app/components/OneEyrieDesktopHeaderActions";
import { APP_SHELL, APP_SHELL_CLASS, MAIN_CONTENT, MAIN_CONTENT_CLASS } from "@/app/lib/oneEyrieLayout";
import {
  goldFilledHoverHandlers,
  goldHoverHandlers,
  GOLD_FILLED_BUTTON,
  GOLD_OUTLINE_ACTION_BUTTON,
  GOLD_OUTLINE_BUTTON,
  NEUTRAL_BUTTON,
  neutralHoverHandlers,
} from "@/app/lib/oneEyrieButtons";
import WorkOrderModal, {
  WorkOrderModalInitialValues,
} from "@/app/maintenance/components/WorkOrderModal";
import { isPassOnReadByUser } from "@/app/pass-on-log/lib/pass-on-views";
import { formatOneEyrieUpdatedTimestamp } from "@/app/lib/one-eyrie-updated-timestamp";
import "@/app/lib/one-eyrie-updated-timestamp.css";
import { priorityClassName } from "@/app/mobile/pass-on-log/lib/pass-on-priority";
import "./pass-on-log-light-theme.css";
import {
  clearPassOnDraft,
  emptyPassOnDraftSnapshot,
  getPassOnDraftSaveStatusLabel,
  getPassOnDraftSaveStatusRefreshDelay,
  loadPassOnDraft,
  passOnDraftHasContent,
  passOnDraftSnapshotsEqual,
  savePassOnDraft,
  type PassOnDraftSnapshot,
} from "@/app/pass-on-log/lib/pass-on-draft";
import { buildMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import {
  formatPassOnBusinessDateHeader,
  getHotelBusinessDateString,
  matchesPassOnDateFilter,
  type PassOnDateFilter,
} from "@/app/lib/hotel-business-date";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const gold = "#C8A96A";

export default function PassOnLogPageContent() {
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [entryDate, setEntryDate] = useState(() => getHotelBusinessDateString());
  const [showDraftCard, setShowDraftCard] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftPriority, setDraftPriority] = useState("Normal");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftEntryDate, setDraftEntryDate] = useState(() =>
    getHotelBusinessDateString()
  );
  const [draftSavedBaseline, setDraftSavedBaseline] = useState<PassOnDraftSnapshot>(
    () => emptyPassOnDraftSnapshot(getHotelBusinessDateString())
  );
  const [draftLastSavedAt, setDraftLastSavedAt] = useState<string | null>(null);
  const [draftSaveButtonState, setDraftSaveButtonState] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const [draftPublishButtonState, setDraftPublishButtonState] = useState<
    "idle" | "publishing" | "published"
  >("idle");
  const [draftCardExitAnimating, setDraftCardExitAnimating] = useState(false);
  const [highlightEntryId, setHighlightEntryId] = useState<number | null>(null);
  const draftSaveResetTimerRef = useRef<number | null>(null);
  const draftHighlightTimerRef = useRef<number | null>(null);
  const draftSaveStatusTimerRef = useRef<number | null>(null);
  const [draftSaveStatusTick, setDraftSaveStatusTick] = useState(0);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(
    () => new Set()
  );
  const [expandedViewsEntry, setExpandedViewsEntry] = useState<number | null>(null);
  const [replyMessages, setReplyMessages] = useState<Record<number, string>>({});
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderInitial, setWorkOrderInitial] = useState<
    WorkOrderModalInitialValues | undefined
  >(undefined);

  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const draftDateInputRef = useRef<HTMLInputElement | null>(null);
  const replyInputRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const pendingReplyFocusRef = useRef<number | null>(null);
  const [dateFilter, setDateFilter] = useState<PassOnDateFilter>("All");
  const [showFilters, setShowFilters] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editingReplyMessage, setEditingReplyMessage] = useState("");
  const [currentUserName, setCurrentUserName] = useState("Unknown");
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
  const [readBaseline, setReadBaseline] = useState<string | null>(null);
  const PASS_ON_DAYS_PER_PAGE = 7;
  const [visibleDayCount, setVisibleDayCount] = useState(PASS_ON_DAYS_PER_PAGE);
  const [loadingMoreDays, setLoadingMoreDays] = useState(false);
  const [canDeleteAnyPassOn, setCanDeleteAnyPassOn] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  const memberResolver = useMemo(
    () => buildMemberDisplayNameResolver(teamMembers),
    [teamMembers]
  );

  function displayAuthor(stored: string | null | undefined) {
    if (!stored) return "Unknown";
    return memberResolver.resolveStoredValue(stored) || stored;
  }

  function isAuthorMatch(storedAuthor: string | null | undefined) {
    if (!storedAuthor || !currentUserName || currentUserName === "Unknown") {
      return false;
    }

    const stored = storedAuthor.trim().toLowerCase();
    const current = currentUserName.trim().toLowerCase();
    if (stored === current) return true;

    return (
      displayAuthor(storedAuthor).trim().toLowerCase() ===
      displayAuthor(currentUserName).trim().toLowerCase()
    );
  }

  function canDeletePassOnContent(storedAuthor: string | null | undefined) {
    return canDeleteAnyPassOn || isAuthorMatch(storedAuthor);
  }

 async function updateEntry(id: number) {
  const entry = entries.find((item) => item.id === id);
  if (!entry || !isAuthorMatch(entry.author)) {
    alert("Only the author can edit this entry.");
    return;
  }

  const text = editingMessage.trim();

  console.log("Saving entry:", id, text);

  if (!text) {
    alert("Entry cannot be blank.");
    return;
  }

  const editedAt = new Date().toISOString();

  const response = await tenantFetch(`/api/pass-on/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Update failed:", result.error);
    alert(result.error || "Unable to update entry");
    return;
  }

  const resolvedEditedAt = result.entry?.edited_at ?? editedAt;

  setEntries((prev) =>
    prev.map((entry) =>
      entry.id === id ? { ...entry, message: text, edited_at: resolvedEditedAt } : entry
    )
  );

  setEditingEntryId(null);
  setEditingMessage("");
}

async function updateReply(replyId: number) {
  const replyEntry = entries
    .flatMap((entry) => entry.pass_on_log_replies || [])
    .find((reply) => reply.id === replyId);

  if (!replyEntry || !isAuthorMatch(replyEntry.reply_author)) {
    alert("Only the author can edit this reply.");
    return;
  }

  const text = editingReplyMessage.trim();
  if (!text) {
    alert("Reply cannot be blank.");
    return;
  }

  const editedAt = new Date().toISOString();
  const response = await tenantFetch(`/api/pass-on/replies/${replyId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reply_message: text }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Reply update failed:", result.error);
    alert(result.error || "Unable to update reply");
    return;
  }

  const resolvedEditedAt = result.reply?.edited_at ?? editedAt;

  setEntries((prev) =>
    prev.map((entry) => ({
      ...entry,
      pass_on_log_replies: (entry.pass_on_log_replies || []).map((reply: any) =>
        reply.id === replyId
          ? { ...reply, reply_message: text, edited_at: resolvedEditedAt }
          : reply
      ),
    }))
  );

  setEditingReplyId(null);
  setEditingReplyMessage("");
}


  async function fetchEntries() {
    const response = await tenantFetch("/api/pass-on");
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setEntries(result.entries || []);
      setReadBaseline(result.readBaseline ?? null);
    }
  }

async function markAsViewed(entryId: number) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return;

  await tenantFetch(`/api/pass-on/${entryId}/views`, { method: "POST" });

  const viewedAt = new Date().toISOString();
  const userId = session.user.id;

  setEntries((prev) =>
    prev.map((entry) => {
      if (entry.id !== entryId) return entry;

      const views = entry.pass_on_log_views || [];
      const existingIndex = views.findIndex(
        (view: { auth_user_id: string }) =>
          String(view.auth_user_id).trim() === String(userId).trim()
      );

      if (existingIndex >= 0) {
        const nextViews = [...views];
        nextViews[existingIndex] = {
          ...nextViews[existingIndex],
          viewed_at: viewedAt,
        };
        return { ...entry, pass_on_log_views: nextViews };
      }

      return {
        ...entry,
        pass_on_log_views: [
          ...views,
          { entry_id: entryId, auth_user_id: userId, viewed_at: viewedAt },
        ],
      };
    })
  );
}

  function resetDraftFeedbackState() {
    if (draftSaveResetTimerRef.current) {
      window.clearTimeout(draftSaveResetTimerRef.current);
      draftSaveResetTimerRef.current = null;
    }
    if (draftHighlightTimerRef.current) {
      window.clearTimeout(draftHighlightTimerRef.current);
      draftHighlightTimerRef.current = null;
    }
    setDraftSaveButtonState("idle");
    setDraftPublishButtonState("idle");
    setDraftCardExitAnimating(false);
  }

  function getCurrentDraftSnapshot(): PassOnDraftSnapshot {
    return {
      subject: draftSubject,
      priority: draftPriority,
      entryDate: draftEntryDate,
      message: draftMessage,
    };
  }

  function applyDraftFields(draft: {
    subject: string;
    priority: string;
    entryDate: string;
    message: string;
  }) {
    setDraftSubject(draft.subject);
    setDraftPriority(draft.priority);
    setDraftEntryDate(draft.entryDate);
    setDraftMessage(draft.message);
  }

  function syncDraftSavedBaseline(draft: PassOnDraftSnapshot, updatedAt: string | null) {
    setDraftSavedBaseline(draft);
    setDraftLastSavedAt(updatedAt);
  }

  function resetDraftFields() {
    setDraftSubject("");
    setDraftPriority("Normal");
    setDraftMessage("");
    setDraftEntryDate(getHotelBusinessDateString());
    syncDraftSavedBaseline(
      emptyPassOnDraftSnapshot(getHotelBusinessDateString()),
      null
    );
  }

  function startDraftCard() {
    if (!currentAuthUserId) return;

    resetDraftFeedbackState();

    const existing = loadPassOnDraft(currentAuthUserId);
    if (existing) {
      applyDraftFields(existing);
      syncDraftSavedBaseline(
        {
          subject: existing.subject,
          priority: existing.priority,
          entryDate: existing.entryDate,
          message: existing.message,
        },
        existing.updatedAt
      );
    } else {
      resetDraftFields();
    }

    setShowDraftCard(true);
  }

  function discardDraft() {
    if (passOnDraftHasContent(getCurrentDraftSnapshot())) {
      if (!confirm("Discard this draft? Your pass-on will be lost.")) return;
    }

    if (currentAuthUserId) {
      clearPassOnDraft(currentAuthUserId);
    }
    resetDraftFields();
    resetDraftFeedbackState();
    setShowDraftCard(false);
  }

  async function saveDraftCard() {
    if (!currentAuthUserId) return;
    if (passOnDraftSnapshotsEqual(getCurrentDraftSnapshot(), draftSavedBaseline)) {
      return;
    }
    if (draftSaveButtonState !== "idle" || draftPublishButtonState !== "idle") return;

    if (draftSaveResetTimerRef.current) {
      window.clearTimeout(draftSaveResetTimerRef.current);
      draftSaveResetTimerRef.current = null;
    }

    setDraftSaveButtonState("saving");

    const updatedAt = new Date().toISOString();
    await new Promise((resolve) => window.setTimeout(resolve, 350));

    savePassOnDraft({
      authUserId: currentAuthUserId,
      author: currentUserName,
      subject: draftSubject,
      priority: draftPriority,
      entryDate: draftEntryDate,
      message: draftMessage,
      updatedAt,
    });

    setDraftSavedBaseline(getCurrentDraftSnapshot());
    setDraftLastSavedAt(updatedAt);
    setDraftSaveButtonState("saved");
    setShowDraftCard(true);

    draftSaveResetTimerRef.current = window.setTimeout(() => {
      setDraftSaveButtonState("idle");
      draftSaveResetTimerRef.current = null;
    }, 2000);
  }

  async function insertPassOnEntry(
    entrySubject: string,
    entryPriority: string,
    entryMessage: string,
    entryDateValue: string
  ): Promise<number | null> {
    const now = new Date();
    const selectedDateTime = new Date(
      `${entryDateValue}T${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}:00`
    ).toISOString();

    const response = await tenantFetch("/api/pass-on", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: entrySubject,
        author: currentUserName,
        priority: entryPriority,
        message: entryMessage,
        created_at: selectedDateTime,
        entry_date: entryDateValue,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      alert(result.error || "Unable to create pass-on entry");
      return null;
    }

    await fetchEntries();
    return result.entry?.id ?? null;
  }

  async function publishDraft() {
    const trimmedSubject = draftSubject.trim();
    const trimmedMessage = draftMessage.trim();

    if (!trimmedSubject || !trimmedMessage) {
      alert("Please enter a subject and pass-on note before publishing.");
      return;
    }

    if (draftPublishButtonState !== "idle") return;

    setDraftPublishButtonState("publishing");

    const entryId = await insertPassOnEntry(
      trimmedSubject,
      draftPriority,
      trimmedMessage,
      draftEntryDate
    );

    if (!entryId) {
      setDraftPublishButtonState("idle");
      return;
    }

    setDraftPublishButtonState("published");
    setDraftCardExitAnimating(true);
    setHighlightEntryId(entryId);

    await new Promise((resolve) => window.setTimeout(resolve, 550));

    if (currentAuthUserId) {
      clearPassOnDraft(currentAuthUserId);
    }
    resetDraftFields();
    resetDraftFeedbackState();
    setShowDraftCard(false);

    window.requestAnimationFrame(() => {
      document
        .getElementById(`pass-on-entry-${entryId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    if (draftHighlightTimerRef.current) {
      window.clearTimeout(draftHighlightTimerRef.current);
    }
    draftHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightEntryId(null);
      draftHighlightTimerRef.current = null;
    }, 2600);
  }

  function queuePassOnReplyFocus(entryId: number) {
    pendingReplyFocusRef.current = entryId;
  }

  function focusPassOnReplyInput(entryId: number) {
    if (editingEntryId === entryId || editingReplyId !== null) return;

    const scrollEl = document.querySelector(
      ".one-eyrie-main-content.one-eyrie-pass-on-log-page"
    ) as HTMLElement | null;
    const lockedMainScroll = scrollEl?.scrollTop ?? 0;
    const lockedWindowScroll = window.scrollY;

    replyInputRefs.current[entryId]?.focus({ preventScroll: true });

    if (scrollEl) scrollEl.scrollTop = lockedMainScroll;
    if (window.scrollY !== lockedWindowScroll) {
      window.scrollTo({
        top: lockedWindowScroll,
        left: window.scrollX,
        behavior: "auto",
      });
    }
  }

  function togglePassOnEntryExpand(entryId: number, isCurrentlyOpen: boolean) {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (isCurrentlyOpen) {
        next.delete(entryId);
      } else {
        next.add(entryId);
        queuePassOnReplyFocus(entryId);
      }
      return next;
    });

    if (!isCurrentlyOpen) {
      void markAsViewed(entryId);
    }
  }

  function expandPassOnEntry(entryId: number) {
    setExpandedEntries((prev) => {
      if (prev.has(entryId)) return prev;
      const next = new Set(prev);
      next.add(entryId);
      return next;
    });
  }

  useLayoutEffect(() => {
    const entryId = pendingReplyFocusRef.current;
    if (entryId === null) return;
    if (!expandedEntries.has(entryId)) {
      pendingReplyFocusRef.current = null;
      return;
    }

    focusPassOnReplyInput(entryId);
    pendingReplyFocusRef.current = null;
  }, [expandedEntries, editingEntryId, editingReplyId]);

  useEffect(() => {
  async function checkAuth() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    setCurrentAuthUserId(session.user.id);

    const { data: teamMember } = await supabase
      .from("team_members")
      .select("first_name, last_name, username, job_title, is_administrator")
      .eq("auth_user_id", session.user.id)
      .single();

    if (teamMember) {
      setCurrentUserName(
        teamMember.username || "unknown"
      );
      const jobTitle = (teamMember.job_title || "").trim();
      setCanDeleteAnyPassOn(
        Boolean(teamMember.is_administrator) ||
          jobTitle === "General Manager" ||
          jobTitle === "Assistant General Manager"
      );
    }

   const { data: allTeamMembers } = await supabase
  .from("team_members")
  .select("auth_user_id, first_name, last_name, username");

setTeamMembers(allTeamMembers || []);
    
    fetchEntries();
  }

  checkAuth();
}, []);

  useEffect(() => {
    if (!currentAuthUserId) return;

    const saved = loadPassOnDraft(currentAuthUserId);
    if (!saved) return;

    applyDraftFields(saved);
    syncDraftSavedBaseline(
      {
        subject: saved.subject,
        priority: saved.priority,
        entryDate: saved.entryDate,
        message: saved.message,
      },
      saved.updatedAt
    );
    setShowDraftCard(true);
  }, [currentAuthUserId]);

  useEffect(() => {
    return () => {
      if (draftSaveResetTimerRef.current) {
        window.clearTimeout(draftSaveResetTimerRef.current);
      }
      if (draftHighlightTimerRef.current) {
        window.clearTimeout(draftHighlightTimerRef.current);
      }
      if (draftSaveStatusTimerRef.current) {
        window.clearTimeout(draftSaveStatusTimerRef.current);
      }
    };
  }, []);

  const currentDraftSnapshot = useMemo(
    (): PassOnDraftSnapshot => ({
      subject: draftSubject,
      priority: draftPriority,
      entryDate: draftEntryDate,
      message: draftMessage,
    }),
    [draftSubject, draftPriority, draftEntryDate, draftMessage]
  );

  const hasUnsavedDraftChanges = useMemo(
    () => !passOnDraftSnapshotsEqual(currentDraftSnapshot, draftSavedBaseline),
    [currentDraftSnapshot, draftSavedBaseline]
  );

  useEffect(() => {
    if (draftSaveStatusTimerRef.current) {
      window.clearTimeout(draftSaveStatusTimerRef.current);
      draftSaveStatusTimerRef.current = null;
    }

    if (!draftLastSavedAt || hasUnsavedDraftChanges) return;

    const refreshDelay = getPassOnDraftSaveStatusRefreshDelay(draftLastSavedAt);
    if (refreshDelay === null) return;

    draftSaveStatusTimerRef.current = window.setTimeout(() => {
      setDraftSaveStatusTick((tick) => tick + 1);
      draftSaveStatusTimerRef.current = null;
    }, refreshDelay);
  }, [draftLastSavedAt, hasUnsavedDraftChanges]);

  const draftFieldsLocked = draftPublishButtonState !== "idle";

  const saveDraftLabel =
    draftSaveButtonState === "saving"
      ? "Saving…"
      : draftSaveButtonState === "saved"
        ? "✓ Saved"
        : "Save Draft";

  const publishDraftLabel =
    draftPublishButtonState === "publishing"
      ? "Publishing…"
      : draftPublishButtonState === "published"
        ? "✓ Published"
        : "Post";

  const draftStatusText = useMemo(() => {
    if (draftSaveButtonState === "saving") return "Saving…";
    if (hasUnsavedDraftChanges) return "Unsaved changes";
    if (draftLastSavedAt) {
      return getPassOnDraftSaveStatusLabel(draftLastSavedAt);
    }
    return "";
  }, [
    draftSaveButtonState,
    hasUnsavedDraftChanges,
    draftLastSavedAt,
    draftSaveStatusTick,
  ]);

  const draftStatusIsSuccess = Boolean(
    draftLastSavedAt && !hasUnsavedDraftChanges && draftSaveButtonState !== "saving"
  );

  const saveDraftDisabled =
    !hasUnsavedDraftChanges ||
    draftSaveButtonState !== "idle" ||
    draftPublishButtonState !== "idle";

  const publishDraftDisabled = draftPublishButtonState !== "idle";
  const discardDraftDisabled = draftPublishButtonState !== "idle";

  const deepLinkEntryId = useMemo(() => {
    const raw = searchParams.get("entry");
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [searchParams]);

  const deepLinkHandled = useRef<number | null>(null);

  useEffect(() => {
    if (!deepLinkEntryId || entries.length === 0) return;
    if (deepLinkHandled.current === deepLinkEntryId) return;

    const entry = entries.find((item) => item.id === deepLinkEntryId);
    if (!entry) return;

    deepLinkHandled.current = deepLinkEntryId;
    setDateFilter("All");
    setSearch("");
    setExpandedEntries((prev) => new Set(prev).add(deepLinkEntryId));
    queuePassOnReplyFocus(deepLinkEntryId);
    markAsViewed(deepLinkEntryId);
  }, [deepLinkEntryId, entries]);

  async function toggleViews(entryId: number) {
  setExpandedViewsEntry(expandedViewsEntry === entryId ? null : entryId);
}

  async function addInlineReply(entryId: number) {
    const text = replyMessages[entryId]?.trim();
    if (!text) return;

    const response = await tenantFetch(`/api/pass-on/${entryId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply_author: currentUserName, reply_message: text }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      alert(result.error || "Unable to send reply");
      return;
    }

    await markAsViewed(entryId);

    setReplyMessages((prev) => ({ ...prev, [entryId]: "" }));
    fetchEntries();
  }

  async function deleteEntry(id: number) {
    const entry = entries.find((item) => item.id === id);
    if (!entry || !canDeletePassOnContent(entry.author)) {
      alert("Only the author or an administrator can delete this entry.");
      return;
    }

    if (!confirm("Delete this pass-on entry?")) return;
    const response = await tenantFetch(`/api/pass-on/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      alert(result.error || "Unable to delete entry");
      return;
    }
    fetchEntries();
  }

  async function deleteReply(replyId: number) {
    const reply = entries
      .flatMap((entry) => entry.pass_on_log_replies || [])
      .find((item) => Number(item.id) === Number(replyId));

    if (!reply || !canDeletePassOnContent(reply.reply_author)) {
      alert("Only the author or an administrator can delete this reply.");
      return;
    }

    if (!confirm("Delete this reply?")) return;

    const response = await tenantFetch(`/api/pass-on/replies/${replyId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      alert(result.error || "Unable to delete this reply. You may not have permission.");
      return;
    }

    setEntries((prev) =>
      prev.map((entry) => ({
        ...entry,
        pass_on_log_replies: (entry.pass_on_log_replies || []).filter(
          (item: { id: number }) => Number(item.id) !== Number(replyId)
        ),
      }))
    );
  }

  function formatDateTime(value: string) {
    return new Date(value).toLocaleString([], {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const filteredEntries = entries.filter((entry) => {
  const matchesSearch = `${entry.subject} ${entry.author} ${entry.message} ${entry.priority}`
    .toLowerCase()
    .includes(search.toLowerCase());

  const matchesDate = matchesPassOnDateFilter(entry.entry_date, dateFilter, {
    customDate: entryDate,
  });

  return matchesSearch && matchesDate;
});

const groupedEntries = filteredEntries.reduce((acc: any, entry: any) => {
  const date = entry.entry_date;

  if (!date) return acc;

  if (!acc[date]) acc[date] = [];
  acc[date].push(entry);

  return acc;
}, {});

// Windowed history: show only the most recent N day-groups, with "Load more"
// revealing the next 7 previous days. The window is bypassed while searching or
// when a specific date filter is active, so search always spans full history
// and does not duplicate already-shown entries.
const groupedEntryPairs = Object.entries(groupedEntries) as [string, any[]][];
const isSearching = search.trim().length > 0;
const dayWindowActive = !isSearching && dateFilter === "All";
const visibleGroupedEntryPairs = dayWindowActive
  ? groupedEntryPairs.slice(0, visibleDayCount)
  : groupedEntryPairs;
const hasMoreDays = dayWindowActive && groupedEntryPairs.length > visibleDayCount;

function loadMoreDays() {
  setLoadingMoreDays(true);
  window.setTimeout(() => {
    setVisibleDayCount((count) => count + PASS_ON_DAYS_PER_PAGE);
    setLoadingMoreDays(false);
  }, 200);
}

function dateHeader(dateString: string) {
  return formatPassOnBusinessDateHeader(dateString);
}



      return (
    <main style={APP_SHELL} className={`${APP_SHELL_CLASS} one-eyrie-pass-on-log-route`}>
      <style>
        {`
          .icon-button:hover,
          .section-button:hover {
            color: #C8A96A !important;
          }

          .gold-button:hover,
          .plus-submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(200, 169, 106, 0.38);
          }

          .pass-on-reply-textarea {
            min-height: 54px;
            resize: vertical;
            overflow: auto;
            width: 100%;
            box-sizing: border-box;
          }

          .pass-on-send-reply-btn:hover {
            background: #d4b87a !important;
            border-color: #d4b87a !important;
          }

          .pass-on-work-order-btn:hover {
            background: rgba(200, 169, 106, 0.1) !important;
            box-shadow: 0 0 14px rgba(200, 169, 106, 0.28);
          }

          .reply-input-wrap {
            align-items: center;
            gap: 12px;
          }

          .reply-input-wrap:focus-within {
            border-color: rgba(200,169,106,0.75) !important;
            box-shadow: 0 0 0 3px rgba(200,169,106,0.08);
          }

          .pass-on-message-row {
            display: flex;
            align-items: stretch;
            gap: 12px;
          }

          .pass-on-message-text {
            flex: 1;
            min-width: 0;
            word-break: break-word;
            overflow-wrap: anywhere;
            white-space: pre-wrap;
          }

          .pass-on-expanded-actions {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: stretch;
            flex-shrink: 0;
          }

          @media (min-width: 769px) {
            .pass-on-draft-card-wrap {
              margin-top: 24px;
            }

            .pass-on-draft-card {
              margin-bottom: 28px;
              padding: 18px 20px;
              border-radius: 14px;
              border: 1px dashed rgba(200, 169, 106, 0.38);
              background: #101010;
              box-shadow:
                0 1px 2px rgba(0, 0, 0, 0.32),
                0 8px 24px rgba(0, 0, 0, 0.2),
                inset 0 1px 0 rgba(255, 255, 255, 0.03);
            }

            .pass-on-draft-card .one-eyrie-form-grid--pass-on {
              gap: 14px;
            }

            .pass-on-draft-card .one-eyrie-form-grid--pass-on__message {
              margin-bottom: 0;
              min-height: 96px !important;
            }

            .pass-on-draft-card__actions {
              margin-top: 10px;
              padding-top: 12px;
            }

            .pass-on-draft-card__actions-status {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              min-height: 14px;
              padding-left: 10px;
              font-size: 10px;
              font-weight: 500;
              line-height: 1.35;
              color: #727880;
            }

            .pass-on-draft-card__actions-status-text {
              color: #9a9590;
              animation: pass-on-draft-status-in 0.18s ease;
            }

            @keyframes pass-on-draft-status-in {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }

            .pass-on-draft-card__actions-check {
              color: #5cb87a;
              font-size: 10px;
              font-weight: 700;
              line-height: 1;
            }

            .pass-on-draft-card__actions-status--success {
              color: #727880;
            }

            .pass-on-draft-card .one-eyrie-field::placeholder {
              color: #8a8480;
            }

            .pass-on-draft-card .one-eyrie-field:focus,
            .pass-on-draft-card .one-eyrie-field:focus-visible {
              border-color: rgba(200, 169, 106, 0.62) !important;
              box-shadow:
                0 0 0 1px rgba(200, 169, 106, 0.22),
                0 0 14px rgba(200, 169, 106, 0.16) !important;
            }

            .pass-on-draft-discard-btn:active:not(:disabled),
            .pass-on-draft-outline-btn:active:not(:disabled),
            .pass-on-draft-publish-btn:active:not(:disabled) {
              transform: scale(0.98);
            }

            .pass-on-draft-outline-btn:hover:not(:disabled) {
              background: rgba(200, 169, 106, 0.08) !important;
              border-color: #d4b87a !important;
            }
          }

          .pass-on-draft-card {
            margin-bottom: 18px;
            padding: 16px;
            border-radius: 14px;
            border: 1px dashed rgba(200, 169, 106, 0.55);
            background: rgba(200, 169, 106, 0.06);
            overflow: hidden;
            transition:
              opacity 0.45s ease,
              transform 0.45s ease,
              max-height 0.45s ease,
              margin-bottom 0.45s ease,
              padding 0.45s ease,
              box-shadow 0.18s ease,
              border-color 0.18s ease,
              background 0.18s ease;
            max-height: 900px;
          }

          .pass-on-draft-card--exit {
            opacity: 0;
            transform: translateY(16px) scale(0.985);
            max-height: 0;
            margin-bottom: 0;
            padding-top: 0;
            padding-bottom: 0;
            pointer-events: none;
          }

          .pass-on-draft-card__header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
            flex-wrap: wrap;
          }

          .pass-on-draft-card__badge {
            display: inline-block;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #111111;
            background: #c8a96a;
          }

          .pass-on-draft-card__hint {
            color: #9ca3af;
            font-size: 12px;
          }

          .pass-on-draft-card__actions {
            margin-top: 14px;
            padding-top: 14px;
            border-top: 1px solid rgba(90, 83, 76, 0.35);
          }

          .pass-on-draft-card__actions-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
          }

          .pass-on-draft-card__actions-left {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            flex-shrink: 0;
          }

          .pass-on-draft-card__actions-left-buttons {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .pass-on-draft-card__actions-draft-col {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
          }

          .pass-on-draft-card__actions-status {
            min-height: 16px;
            padding-left: 10px;
            font-size: 11px;
            line-height: 1.35;
            color: #727880;
            text-align: left;
          }

          .pass-on-draft-card__actions-status--success {
            color: #727880;
          }

          .pass-on-draft-card__actions-publish {
            flex-shrink: 0;
            margin-left: auto;
          }

          .pass-on-draft-discard-btn:hover:not(:disabled) {
            background: #3d3934 !important;
            border-color: #6a635c !important;
          }

          .pass-on-draft-discard-btn,
          .pass-on-draft-outline-btn,
          .pass-on-draft-publish-btn {
            transition:
              opacity 0.18s ease,
              border-color 0.18s ease,
              background 0.18s ease,
              transform 0.18s ease,
              box-shadow 0.18s ease;
          }

          .pass-on-draft-publish-btn:hover:not(:disabled) {
            background: #d4b87a !important;
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(200, 169, 106, 0.38);
          }

          .one-eyrie-list-row--just-published {
            animation: pass-on-entry-arrive 0.55s ease;
            box-shadow: 0 0 0 1px rgba(200, 169, 106, 0.55);
          }

          @keyframes pass-on-entry-arrive {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @media (max-width: 900px) {
            .pass-on-message-row {
              flex-direction: column;
              align-items: stretch;
            }

            .pass-on-expanded-actions {
              width: 100%;
              flex-direction: row;
              flex-wrap: wrap;
              justify-content: flex-start;
            }
          }
        `}
      </style>

      <OneEyrieSidebar active="Pass-On" />

      <section
        style={{ ...MAIN_CONTENT, maxWidth: "100%" }}
        className={`${MAIN_CONTENT_CLASS} one-eyrie-pass-on-log-page`}
      >
        <div className="one-eyrie-pass-on-page-header-wrap">
          <OneEyriePageHeader
            title="Pass-On Log"
            subtitle="Shift notes and hotel communication"
            align="center"
            actions={
              <OneEyrieDesktopHeaderActions>
                <button
                  type="button"
                  style={GOLD_OUTLINE_BUTTON}
                  className="one-eyrie-btn one-eyrie-btn--gold-outline one-eyrie-btn--lg"
                  onClick={startDraftCard}
                  {...goldHoverHandlers("secondary")}
                >
                  New Draft
                </button>
              </OneEyrieDesktopHeaderActions>
            }
          />
        </div>

        <div className="one-eyrie-pass-on-page-body" style={{ maxWidth: "1120px", margin: "0 auto" }}>
          <div style={panelStyle} className="pass-on-log-panel">
  <div className="one-eyrie-pass-on-toolbar" style={searchHeaderRow}>
    <div className="one-eyrie-pass-on-search-wrap pass-on-search-wrap" style={searchWrap}>
      <Search
        size={18}
        className="pass-on-search-wrap__icon"
        aria-hidden
      />
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search pass-on entries..."
        className="one-eyrie-field"
        style={searchInput}
      />
    </div>

    <button
      type="button"
      style={calendarIconButton}
      onClick={() => {
        if (showCalendar) {
          setShowCalendar(false);
          return;
        }

        setShowCalendar(true);

        setTimeout(() => {
          dateInputRef.current?.showPicker?.();
        }, 50);
      }}
    >
      <Calendar size={15} />
    </button>

    {showCalendar && (
      <input
        ref={dateInputRef}
        type="date"
        value={entryDate}
        onChange={(e) => {
          setEntryDate(e.target.value);
          setDateFilter("Custom");
          setShowCalendar(false);
        }}
        onBlur={() => {
          setTimeout(() => setShowCalendar(false), 150);
        }}
        style={calendarPopupInput}
      />
    )}

    <select
  value={dateFilter}
  onChange={(e) => setDateFilter(e.target.value as PassOnDateFilter)}
  style={filterDropdown}
>
  <option value="All">All</option>
  <option value="Today">Today</option>
  <option value="Tomorrow">Tomorrow</option>
  <option value="Scheduled">Scheduled</option>
  <option value="Yesterday">Yesterday</option>
</select>
  </div>
  
            {showDraftCard ? (
              <div className="pass-on-draft-card-wrap">
                <div
                  className={`pass-on-draft-card${
                    draftCardExitAnimating ? " pass-on-draft-card--exit" : ""
                  }`}
                >
                <div className="pass-on-draft-card__header">
                  <span className="pass-on-draft-card__badge">Draft</span>
                  <span className="pass-on-draft-card__hint">
                    Only you can see this until posted
                  </span>
                </div>

                <div className="one-eyrie-form-grid--pass-on" style={formStyle}>
                  <input
                    value={draftSubject}
                    onChange={(e) => setDraftSubject(e.target.value)}
                    placeholder="Subject"
                    className="one-eyrie-field"
                    style={inputStyle}
                    disabled={draftFieldsLocked}
                  />

                  <select
                    value={draftPriority}
                    onChange={(e) => setDraftPriority(e.target.value)}
                    className="one-eyrie-field"
                    style={inputStyle}
                    disabled={draftFieldsLocked}
                  >
                    <option>Normal</option>
                    <option>Important</option>
                    <option>Urgent</option>
                  </select>

                  <div className="one-eyrie-form-grid--pass-on__actions">
                    <div style={dateInputWrap} className="pass-on-date-wrap">
                      <button
                        type="button"
                        style={calendarButton}
                        onClick={() => draftDateInputRef.current?.showPicker?.()}
                        disabled={draftFieldsLocked}
                      >
                        <Calendar size={17} />
                      </button>

                      <input
                        ref={draftDateInputRef}
                        type="date"
                        value={draftEntryDate}
                        onChange={(e) => setDraftEntryDate(e.target.value)}
                        style={dateInput}
                        disabled={draftFieldsLocked}
                      />
                    </div>
                  </div>

                  <textarea
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    placeholder="Write pass-on note..."
                    className="one-eyrie-field one-eyrie-form-grid--pass-on__message"
                    style={{
                      ...inputStyle,
                      gridColumn: "1 / -1",
                      minHeight: "110px",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                    disabled={draftFieldsLocked}
                  />

                  <div
                    className="pass-on-draft-card__actions"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    <div className="pass-on-draft-card__actions-row">
                      <div className="pass-on-draft-card__actions-left">
                        <button
                          type="button"
                          style={{
                            ...NEUTRAL_BUTTON,
                            opacity: discardDraftDisabled ? 0.55 : 1,
                            cursor: discardDraftDisabled ? "not-allowed" : "pointer",
                          }}
                          className="one-eyrie-btn one-eyrie-btn--neutral one-eyrie-btn--md pass-on-draft-discard-btn"
                          onClick={discardDraft}
                          disabled={discardDraftDisabled}
                          {...neutralHoverHandlers(discardDraftDisabled)}
                        >
                          Discard
                        </button>

                        <div className="pass-on-draft-card__actions-draft-col">
                          <button
                            type="button"
                            style={{
                              ...GOLD_OUTLINE_ACTION_BUTTON,
                              opacity: saveDraftDisabled ? 0.55 : 1,
                              cursor: saveDraftDisabled ? "not-allowed" : "pointer",
                            }}
                            className="one-eyrie-btn one-eyrie-btn--gold-outline one-eyrie-btn--md pass-on-draft-outline-btn"
                            onClick={() => void saveDraftCard()}
                            disabled={saveDraftDisabled}
                            {...goldHoverHandlers("secondary", saveDraftDisabled)}
                          >
                            {saveDraftLabel}
                          </button>

                          {draftStatusText ? (
                            <div
                              className={`pass-on-draft-card__actions-status${
                                draftStatusIsSuccess
                                  ? " pass-on-draft-card__actions-status--success"
                                  : ""
                              }`}
                              aria-live="polite"
                            >
                              {draftStatusIsSuccess ? (
                                <span
                                  className="pass-on-draft-card__actions-check"
                                  aria-hidden="true"
                                >
                                  ✓
                                </span>
                              ) : null}
                              <span
                                key={draftStatusText}
                                className="pass-on-draft-card__actions-status-text"
                              >
                                {draftStatusText}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="pass-on-draft-card__actions-publish">
                        <button
                          type="button"
                          style={{
                            ...GOLD_FILLED_BUTTON,
                            opacity: publishDraftDisabled ? 0.55 : 1,
                            cursor: publishDraftDisabled ? "not-allowed" : "pointer",
                          }}
                          className="one-eyrie-btn one-eyrie-btn--gold-filled one-eyrie-btn--md pass-on-draft-publish-btn"
                          onClick={() => void publishDraft()}
                          disabled={publishDraftDisabled}
                          {...goldFilledHoverHandlers(publishDraftDisabled)}
                        >
                          <Send size={14} strokeWidth={2.25} aria-hidden />
                          {publishDraftLabel}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            ) : null}

            <div
              className={`pass-on-entries-list${
                showDraftCard ? " pass-on-entries-list--after-draft" : ""
              }`}
              style={{ marginTop: showDraftCard ? "0" : "18px" }}
            >
              {!filteredEntries.length ? (
                <p style={{ color: "#9CA3AF" }}>No pass-on entries yet.</p>
              ) : (
             visibleGroupedEntryPairs.map(([dateKey, entriesForDate]: any) => (
  <div key={dateKey}>
    <h3 className="pass-on-day-heading" style={{ color: gold, fontSize: "14px", margin: "18px 0 8px" }}>
      {dateHeader(dateKey)}
    </h3>

    <div className="one-eyrie-pass-on-day-entries">
    {entriesForDate.map((entry: any) => {
      const isOpen = expandedEntries.has(entry.id);
      const replyCount = entry.pass_on_log_replies?.length || 0;
      const viewCount = entry.pass_on_log_views?.length || 0;
      const isRead = isPassOnReadByUser(entry, currentAuthUserId, readBaseline);

      return (
        <div
          key={entry.id}
          id={`pass-on-entry-${entry.id}`}
          className={`one-eyrie-list-row${isOpen ? " one-eyrie-list-row--selected" : ""}${
            isRead ? " one-eyrie-list-row--read" : " one-eyrie-list-row--unread"
          }${entry.id === highlightEntryId ? " one-eyrie-list-row--just-published" : ""}`}
          style={{ padding: "10px 12px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}
        >
          <div className="one-eyrie-pass-on-entry-row" style={collapsedRow}>
            <button
              type="button"
              onClick={() => togglePassOnEntryExpand(entry.id, isOpen)}
            >
              {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>

            <span
              className={`one-eyrie-pass-on-read-dot${
                isRead ? " one-eyrie-pass-on-read-dot--read" : ""
              }`}
              aria-label={isRead ? "Read" : "Unread"}
            />

            <div
              className={priorityClassName(entry.priority || "Normal")}
              style={priorityPill(entry.priority)}
            >
              {entry.priority || "Normal"}
            </div>

            <div
              onClick={() => togglePassOnEntryExpand(entry.id, isOpen)}
              style={{ flex: 1, cursor: "pointer" }}
              className="one-eyrie-pass-on-entry-subject"
            >
              <div className="one-eyrie-pass-on-entry-subject-text" style={rowSubject}>
                {entry.subject}
              </div>
              <div className="one-eyrie-pass-on-entry-meta-line" style={rowMeta}>
  {displayAuthor(entry.author)} · {formatDateTime(entry.created_at)}
</div>

{entry.edited_at && (
  <div className="one-eyrie-updated-timestamp">
    {formatOneEyrieUpdatedTimestamp(entry.edited_at)}
  </div>
)}
</div>

            <div className="one-eyrie-pass-on-entry-meta" style={rowCounts}>
              <button
                type="button"
                onClick={() => toggleViews(entry.id)}
                className="one-eyrie-icon-btn section-button"
                style={smallActionButton}
              >
                <Eye size={15} />
                <span>{viewCount}</span>
              </button>

              <button
                type="button"
                onClick={() => togglePassOnEntryExpand(entry.id, isOpen)}
                className="one-eyrie-icon-btn section-button"
                style={smallActionButton}
              >
                <MessageCircle size={15} />
                <span>{replyCount}</span>
              </button>
            </div>

            <div style={rowIcons}>
              {isAuthorMatch(entry.author) ? (
                <button
                  type="button"
                  className="one-eyrie-icon-btn"
                  style={iconButton}
                  onClick={() => {
                    if (editingEntryId === entry.id) {
                      setEditingEntryId(null);
                      setEditingMessage("");
                    } else {
                      setEditingReplyId(null);
                      setEditingReplyMessage("");
                      setEditingEntryId(entry.id);
                      setEditingMessage(entry.message || "");
                      expandPassOnEntry(entry.id);
                    }
                  }}
                >
                  <Edit2 size={14} />
                </button>
              ) : null}

              {canDeletePassOnContent(entry.author) ? (
                <button
                  type="button"
                  className="one-eyrie-icon-btn"
                  onClick={() => deleteEntry(entry.id)}
                  style={iconButton}
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          </div>

          {isOpen && (
            <div className="one-eyrie-pass-on-entry-expanded" style={expandedArea}>
              <div className="pass-on-message-row" style={messageRowBox}>
                <div
                  className="original-post-box pass-on-message-text"
                  style={messageTextBox}
                >
                  {editingEntryId === entry.id ? (
                    <div style={{ width: "100%" }}>
                      <textarea
                        value={editingMessage}
                        onChange={(e) => setEditingMessage(e.target.value)}
                        className="one-eyrie-field"
                        style={textareaStyle}
                      />

                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button
                          type="button"
                          style={replyPillButton}
                          onClick={() => updateEntry(entry.id)}
                        >
                          Save
                        </button>

                        <button
                          type="button"
                          style={replyPillButton}
                          onClick={() => {
                            setEditingEntryId(null);
                            setEditingMessage("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    entry.message
                  )}
                </div>

                <div className="pass-on-expanded-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkOrderInitial({
                        subject: entry.subject,
                        description: entry.message,
                        priority:
                          (entry.priority as "Normal" | "Important" | "Urgent") ||
                          "Normal",
                        source_module: "Pass-On Log",
                        source_record_id: String(entry.id),
                        source_note: entry.message,
                        created_by: currentUserName,
                      });
                      setWorkOrderModalOpen(true);
                    }}
                    className="pass-on-work-order-btn"
                    style={workOrderActionButton}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(200,169,106,0.1)";
                      e.currentTarget.style.boxShadow =
                        "0 0 14px rgba(200,169,106,0.28)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    Create Work Order
                  </button>
                </div>
              </div>



              {entry.pass_on_log_replies?.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  {entry.pass_on_log_replies.map((reply: any) => (
                    <div
                      key={reply.id}
                      className="reply-preview-box"
                      style={replyPreviewBox}
                    >
                      {editingReplyId === reply.id ? (
                        <div style={{ width: "100%" }}>
                          <textarea
                            value={editingReplyMessage}
                            onChange={(e) => setEditingReplyMessage(e.target.value)}
                            className="one-eyrie-field"
                            style={textareaStyle}
                          />
                          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                            <button
                              type="button"
                              style={replyPillButton}
                              onClick={() => updateReply(reply.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              style={replyPillButton}
                              onClick={() => {
                                setEditingReplyId(null);
                                setEditingReplyMessage("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "8px",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div>
                              <strong>{displayAuthor(reply.reply_author)}:</strong>{" "}
                              {reply.reply_message}
                            </div>
                            {reply.edited_at ? (
                              <div className="one-eyrie-updated-timestamp">
                                {formatOneEyrieUpdatedTimestamp(reply.edited_at)}
                              </div>
                            ) : null}
                          </div>
                          <div
                            className="reply-preview-box__actions"
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "4px",
                              flexShrink: 0,
                            }}
                          >
                            {isAuthorMatch(reply.reply_author) ? (
                              <button
                                type="button"
                                className="one-eyrie-icon-btn"
                                style={iconButton}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingEntryId(null);
                                  setEditingMessage("");
                                  setEditingReplyId(reply.id);
                                  setEditingReplyMessage(reply.reply_message || "");
                                }}
                              >
                                <Edit2 size={12} />
                              </button>
                            ) : null}
                            {canDeletePassOnContent(reply.reply_author) ? (
                              <button
                                type="button"
                                className="one-eyrie-icon-btn"
                                style={iconButton}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void deleteReply(reply.id);
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="reply-input-wrap" style={replyInputWrap}>
                <textarea
                  ref={(el) => {
                    replyInputRefs.current[entry.id] = el;
                  }}
                  value={replyMessages[entry.id] || ""}
                  onChange={(e) =>
                    setReplyMessages((prev) => ({
                      ...prev,
                      [entry.id]: e.target.value,
                    }))
                  }
                  placeholder="Write a reply..."
                  className="one-eyrie-field pass-on-reply-textarea"
                  style={replyTextarea}
                />

                <button
                  type="button"
                  onClick={() => addInlineReply(entry.id)}
                  className="plus-submit pass-on-send-reply-btn"
                  style={replySendButton}
                >
                  <Send size={14} strokeWidth={2.25} aria-hidden />
                  Send Reply
                </button>
              </div>

{entry.pass_on_log_views?.length > 0 && (
  <div className="pass-on-viewed-by-row" style={viewedByRow}>
    <strong>Viewed by:</strong>{" "}
    {entry.pass_on_log_views
      .map((view: any) => {
        const member = teamMembers.find(
  (person: any) =>
    String(person.auth_user_id).trim() === String(view.auth_user_id).trim()
);

        return memberResolver.displayForAuthUserId(view.auth_user_id) || "Unknown";
      })
      .join(", ")}
  </div>
)}
 
              
            </div>
          )}
        </div>
      );
    })}
    </div>
  </div>
))
              )}

              {hasMoreDays ? (
                <div
                  className="pass-on-load-more-wrap"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: "20px",
                  }}
                >
                  <button
                    type="button"
                    className="pass-on-load-more-btn"
                    onClick={loadMoreDays}
                    disabled={loadingMoreDays}
                    style={{ ...NEUTRAL_BUTTON, opacity: loadingMoreDays ? 0.7 : 1 }}
                    {...neutralHoverHandlers}
                  >
                    {loadingMoreDays ? "Loading…" : "Load more"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
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
   
const panelStyle: React.CSSProperties = {
  background: "#0B0B0B",
  border: "1px solid #2A2A2A",
  borderRadius: "18px",
  padding: "24px",
};

const searchWrap: React.CSSProperties = {
  position: "relative",
  flex: 1,
};

const searchInput: React.CSSProperties = {
  padding: "11px 12px",
  paddingLeft: "42px",
  outline: "none",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
};

const formStyle: React.CSSProperties = {
  gap: "12px",
};

const inputStyle: React.CSSProperties = {
  borderRadius: "10px",
  padding: "12px 14px",
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  width: "100%",
  minHeight: "120px",
  fontSize: "15px",
  lineHeight: 1.5,
  resize: "vertical",
};

const collapsedRow: React.CSSProperties = {};

const expandButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#E5E7EB",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  alignItems: "center",
};

const rowSubject: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: ONE_EYRIE.textRow,
};

const rowMeta: React.CSSProperties = {
  marginTop: "3px",
  fontSize: "12px",
  color: ONE_EYRIE.textRow,
};

const rowCounts: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  minWidth: "86px",
};

const smallActionButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  background: "transparent",
  border: "none",
  color: "#E5E7EB",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
};

const rowIcons: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const iconButton: React.CSSProperties = {
  background: "transparent",
  color: "#E5E7EB",
  border: "none",
  borderRadius: "6px",
  padding: "3px",
  cursor: "pointer",
  transition: "all 0.18s ease",
};

const expandedArea: React.CSSProperties = {
  marginTop: "10px",
  paddingLeft: "30px",
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const originalPostBox: React.CSSProperties = {
  background: "#0D0D0D",
  borderTop: "1px solid #2A2A2A",
  borderRight: "1px solid #2A2A2A",
  borderBottom: "1px solid #2A2A2A",
  borderLeft: `3px solid ${gold}`,
  borderRadius: "8px",
  padding: "10px 12px",
  color: ONE_EYRIE.textRow,
  fontSize: "14px",
  transition: "all 0.18s ease",
};

const replyPreviewBox: React.CSSProperties = {
  background: "#0D0D0D",
  border: "1px solid #2A3345",
  borderLeft: `3px solid ${gold}`,
  borderRadius: "8px",
  padding: "7px 10px",
  marginBottom: "5px",
  color: "#E5E7EB",
  fontSize: "13px",
  marginLeft: "18px",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
  maxWidth: "100%",
  boxSizing: "border-box",
};

const expandedActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "18px",
  marginTop: "10px",
};

const sectionButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  background: "transparent",
  border: "none",
  color: "#FFFFFF",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
  transition: "all 0.18s ease",
};

const viewsList: React.CSSProperties = {
  marginTop: "8px",
  paddingLeft: "18px",
  display: "grid",
  gap: "6px",
  color: "#D1D5DB",
  fontSize: "12px",
};

const viewRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "14px auto auto",
  alignItems: "center",
  gap: "8px",
};

const replyInputWrap: React.CSSProperties = {
  marginTop: "10px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  background: ONE_EYRIE.surface,
  border: `1px solid rgba(200, 169, 106, 0.35)`,
  borderRadius: "14px",
  padding: "10px 12px",
  transition: "all 0.18s ease",
  boxSizing: "border-box",
};

const replyTextarea: React.CSSProperties = {
  ...textareaStyle,
  flex: 1,
  minHeight: "54px",
  fontSize: "14px",
  resize: "vertical",
};

function priorityPill(priority: string): React.CSSProperties {
  const color =
    priority === "Urgent"
      ? FLAT_RED.border
      : priority === "Important"
      ? gold
      : FOREST.border;

  const textColor =
    priority === "Urgent"
      ? FLAT_RED.text
      : priority === "Important"
      ? gold
      : FOREST.text;

  return {
    display: "inline-block",
    color: textColor,
    border: `1px solid ${color}`,
    borderRadius: "999px",
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  };
}

const dateInputWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  borderRadius: "10px",
  padding: "0 12px",
};

const dateInput: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  color: "#FFFFFF",
  border: "none",
  outline: "none",
  padding: "12px 0",
};

const calendarButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: gold,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  padding: 0,
  flexShrink: 0,
};

const replyComposerHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  color: "#C8A96A",
  fontWeight: 600,
  marginBottom: "10px",
};

const replyComposerFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "10px",
};

const replyHint: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
};

const replySendButton: React.CSSProperties = {
  background: gold,
  border: `1px solid ${gold}`,
  color: "#111111",
  borderRadius: "14px",
  padding: "8px 14px",
  minHeight: "36px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontSize: "12px",
  flexShrink: 0,
  alignSelf: "center",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  transition: "all 0.18s ease",
};

const messageRowBox: React.CSSProperties = {
  marginTop: "12px",
};

const messageTextBox: React.CSSProperties = {
  background: "#0D0D0D",
  border: "1px solid #2A2A2A",
  borderLeft: `4px solid ${gold}`,
  borderRadius: "10px",
  padding: "12px 14px",
  color: ONE_EYRIE.textRow,
  lineHeight: 1.5,
  transition: "all 0.18s ease",
  wordBreak: "break-word",
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
  maxWidth: "100%",
  boxSizing: "border-box",
};

const replyPillButton: React.CSSProperties = {
  background: "transparent",
  color: gold,
  border: `1px solid ${gold}`,
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all 0.18s ease",
};

const workOrderActionButton: React.CSSProperties = {
  background: "transparent",
  color: gold,
  border: `1px solid ${gold}`,
  borderRadius: "999px",
  padding: "7px 12px",
  fontSize: "12px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "all 0.18s ease",
};

const viewedByRow: React.CSSProperties = {
  marginTop: "12px",
  paddingTop: "10px",
  borderTop: "1px solid #2A2A2A",
  color: "#9CA3AF",
  fontSize: "12px",
};

const searchHeaderRow: React.CSSProperties = {
  position: "relative",
};

const calendarIconButton: React.CSSProperties = {
  background: "#302D28",
  border: "1px solid #C8A96A",
  color: "#FFFFFF",
  borderRadius: "10px",
  width: "42px",
  height: "42px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.18s ease",
};

const calendarPopupInput: React.CSSProperties = {
  position: "absolute",
  top: "48px",
  right: "125px",
  width: "34px",
  height: "34px",
  opacity: 0.01,
  zIndex: 1000,
};

const filterDropdown: React.CSSProperties = {
  background: "#302D28",
  border: "1px solid #C8A96A",
  color: "#FFFFFF",
  borderRadius: "999px",
  height: "42px",
  padding: "0 16px",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "14px",
  outline: "none",
};
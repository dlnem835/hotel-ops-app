"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Eye,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  Calendar,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import OneEyrieDesktopHeaderActions from "@/app/components/OneEyrieDesktopHeaderActions";
import { APP_SHELL, APP_SHELL_CLASS, MAIN_CONTENT, MAIN_CONTENT_CLASS } from "@/app/lib/oneEyrieLayout";
import {
  forestHoverHandlers,
  PRIMARY_BUTTON,
} from "@/app/lib/oneEyrieButtons";
import WorkOrderModal, {
  WorkOrderModalInitialValues,
} from "@/app/maintenance/components/WorkOrderModal";
import { isPassOnReadByUser } from "@/app/pass-on-log/lib/pass-on-views";
import { buildMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import {
  formatPassOnBusinessDateHeader,
  getHotelBusinessDateString,
  matchesPassOnDateFilter,
  type PassOnDateFilter,
} from "@/app/lib/hotel-business-date";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const gold = "#C8A96A";

export default function PassOnLogPageContent() {
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [message, setMessage] = useState("");
  const [entryDate, setEntryDate] = useState(() => getHotelBusinessDateString());
  const [showForm, setShowForm] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const [expandedViewsEntry, setExpandedViewsEntry] = useState<number | null>(null);
  const [expandedReplyEntry, setExpandedReplyEntry] = useState<number | null>(null);
  const [replyMessages, setReplyMessages] = useState<Record<number, string>>({});
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderInitial, setWorkOrderInitial] = useState<
    WorkOrderModalInitialValues | undefined
  >(undefined);

  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const [dateFilter, setDateFilter] = useState<PassOnDateFilter>("All");
  const [showFilters, setShowFilters] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editingReplyMessage, setEditingReplyMessage] = useState("");
  const [currentUserName, setCurrentUserName] = useState("Unknown");
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
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

  const { data, error } = await supabase
    .from("pass_on_log")
    .update({ message: text,
    edited_at: editedAt,
     })
    .eq("id", id)
    .select();

    console.log("Updated entry", data);
    console.log("Updat error:", error);


  if (error) {
    console.error("Update failed:", error);
    alert(error.message);
    return;
  }

  console.log("Updated entry:", data);

  setEntries((prev) =>
    prev.map((entry) =>
      entry.id === id ? { ...entry, message: text, edited_at: editedAt } : entry
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
  const { error } = await supabase
    .from("pass_on_log_replies")
    .update({
      reply_message: text,
      edited_at: editedAt,
    })
    .eq("id", replyId);

  if (error) {
    console.error("Reply update failed:", error);
    alert(error.message);
    return;
  }

  setEntries((prev) =>
    prev.map((entry) => ({
      ...entry,
      pass_on_log_replies: (entry.pass_on_log_replies || []).map((reply: any) =>
        reply.id === replyId
          ? { ...reply, reply_message: text, edited_at: editedAt }
          : reply
      ),
    }))
  );

  setEditingReplyId(null);
  setEditingReplyMessage("");
}


  async function fetchEntries() {
    const { data } = await supabase
      .from("pass_on_log")
      .select("*, pass_on_log_replies(*), pass_on_log_views(*)")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });

    setEntries(data || []);
  }

async function markAsViewed(entryId: number) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  console.log("SESSION:", session);

  if (!session) return;

  const result = await supabase
    .from("pass_on_log_views")
    .upsert(
      {
        entry_id: entryId,
        auth_user_id: session.user.id,
        viewed_at: new Date().toISOString(),
      },
      {
        onConflict: "entry_id,auth_user_id",
      }
    );

  console.log("VIEW RESULT:", result);

  fetchEntries();
}

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
    setExpandedEntry(deepLinkEntryId);
    markAsViewed(deepLinkEntryId);

    requestAnimationFrame(() => {
      document
        .getElementById(`pass-on-entry-${deepLinkEntryId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [deepLinkEntryId, entries]);

  async function addEntry(e: any) {
    e.preventDefault();

    if (!subject || !message) {
      alert("Please enter a subject and message.");
      return;
    }

    const now = new Date();
    const selectedDateTime = new Date(
      `${entryDate}T${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}:00`
    ).toISOString();

    const { error } = await supabase.from("pass_on_log").insert([
      {
        subject,
        author: currentUserName,
        priority,
        message,
        created_at: selectedDateTime,
        entry_date: entryDate,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setSubject("");
    setPriority("Normal");
    setMessage("");
    setEntryDate(new Date().toISOString().split("T")[0]);
    setShowForm(false);
    fetchEntries();
  }

 async function toggleViews(entryId: number) {
  setExpandedViewsEntry(expandedViewsEntry === entryId ? null : entryId);
}

  async function addInlineReply(entryId: number) {
    const text = replyMessages[entryId]?.trim();
    if (!text) return;

    await supabase.from("pass_on_log_replies").insert([
      {
        entry_id: entryId,
        reply_author: currentUserName,
        reply_message: text,
      },
    ]);

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
    await supabase.from("pass_on_log").delete().eq("id", id);
    fetchEntries();
  }

  async function deleteReply(replyId: number) {
    const reply = entries
      .flatMap((entry) => entry.pass_on_log_replies || [])
      .find((item) => item.id === replyId);

    if (!reply || !canDeletePassOnContent(reply.reply_author)) {
      alert("Only the author or an administrator can delete this reply.");
      return;
    }

    if (!confirm("Delete this reply?")) return;

    const { error } = await supabase
      .from("pass_on_log_replies")
      .delete()
      .eq("id", replyId);

    if (error) {
      alert(error.message);
      return;
    }

    fetchEntries();
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

function dateHeader(dateString: string) {
  return formatPassOnBusinessDateHeader(dateString);
}



      return (
    <main style={APP_SHELL} className={APP_SHELL_CLASS}>
      <style>
        {`
          .icon-button:hover,
          .section-button:hover {
            color: #C8A96A !important;
          }

          .gold-button:hover,
          .plus-submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 22px rgba(61, 107, 79, 0.25);
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
            gap: 8px;
            flex-shrink: 0;
            width: 148px;
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

      <OneEyrieSidebar active="Pass-On Log" />

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
                  style={PRIMARY_BUTTON}
                  onClick={() => setShowForm(true)}
                  {...forestHoverHandlers()}
                >
                  <Plus size={18} /> New
                </button>
              </OneEyrieDesktopHeaderActions>
            }
          />
        </div>

        <div className="one-eyrie-pass-on-page-body" style={{ maxWidth: "1120px", margin: "0 auto" }}>
          <div style={panelStyle}>
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
  
   {showForm && (
              <div style={modalOverlay}>
                <div style={modalBox}>
                  <div style={modalHeader}>
                    <h2 style={{ margin: 0 }}>New Pass-On Entry</h2>

                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      style={closeButton}
                      aria-label="Close"
                    >
                      <X size={22} />
                    </button>
                  </div>

                  <form onSubmit={addEntry} className="one-eyrie-form-grid--pass-on" style={formStyle}>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Subject"
                      className="one-eyrie-field"
                      style={inputStyle}
                    />

                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="one-eyrie-field"
                      style={inputStyle}
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
                          onClick={() => dateInputRef.current?.showPicker?.()}
                        >
                          <Calendar size={17} />
                        </button>

                        <input
                          ref={dateInputRef}
                          type="date"
                          value={entryDate}
                          onChange={(e) => setEntryDate(e.target.value)}
                          style={dateInput}
                        />
                      </div>

                      <button
                        type="submit"
                        className="gold-button one-eyrie-form-grid--pass-on__submit"
                        style={goldButton}
                      >
                        Add Entry
                      </button>
                    </div>

                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write pass-on note..."
                      className="one-eyrie-field one-eyrie-form-grid--pass-on__message"
                      style={{
                        ...inputStyle,
                        gridColumn: "1 / -1",
                        minHeight: "110px",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  </form>
                </div>
              </div>
            )}

            <div style={{ marginTop: "18px" }}>
              {!filteredEntries.length ? (
                <p style={{ color: "#9CA3AF" }}>No pass-on entries yet.</p>
              ) : (
             Object.entries(groupedEntries).map(([dateKey, entriesForDate]: any) => (
  <div key={dateKey}>
    <h3 style={{ color: gold, fontSize: "14px", margin: "18px 0 8px" }}>
      {dateHeader(dateKey)}
    </h3>

    <div className="one-eyrie-pass-on-day-entries">
    {entriesForDate.map((entry: any) => {
      const isOpen = expandedEntry === entry.id;
      const replyCount = entry.pass_on_log_replies?.length || 0;
      const viewCount = entry.pass_on_log_views?.length || 0;
      const isRead = isPassOnReadByUser(entry, currentAuthUserId);

      return (
        <div
          key={entry.id}
          id={`pass-on-entry-${entry.id}`}
          className={`one-eyrie-list-row${isOpen ? " one-eyrie-list-row--selected" : ""}${
            isRead ? " one-eyrie-list-row--read" : " one-eyrie-list-row--unread"
          }`}
          style={{ padding: "10px 12px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}
        >
          <div className="one-eyrie-pass-on-entry-row" style={collapsedRow}>
            <button
              type="button"
              onClick={() => {
  setExpandedEntry(isOpen ? null : entry.id);

  if (!isOpen) {
    markAsViewed(entry.id);
  }
}}
            >
              {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
            </button>

            <span
              className={`one-eyrie-pass-on-read-dot${
                isRead ? " one-eyrie-pass-on-read-dot--read" : ""
              }`}
              aria-label={isRead ? "Read" : "Unread"}
            />

            <div style={priorityPill(entry.priority)}>
              {entry.priority || "Normal"}
            </div>

            <div
              onClick={() => {
  setExpandedEntry(isOpen ? null : entry.id);

  if (!isOpen) {
    markAsViewed(entry.id);
  }
}}
              style={{ flex: 1, cursor: "pointer" }}
              className="one-eyrie-pass-on-entry-subject"
            >
              <div className="one-eyrie-pass-on-entry-subject-text" style={rowSubject}>
                {entry.subject}
              </div>
              <div style={rowMeta}>
  {displayAuthor(entry.author)} · {formatDateTime(entry.created_at)}
</div>

{entry.edited_at && (
  <div style={{ fontSize: "11px", color: "#C8A96A", marginTop: "2px" }}>
    ✎ Edited {formatDateTime(entry.edited_at)}
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
                onClick={() => {
  const isOpening = expandedEntry !== entry.id;

  setExpandedEntry(isOpening ? entry.id : null);

  if (isOpening) {
    markAsViewed(entry.id);
  }

              
                }}
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
                      setExpandedEntry(entry.id);
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
                    onClick={() =>
                      setExpandedReplyEntry(
                        expandedReplyEntry === entry.id ? null : entry.id
                      )
                    }
                    style={replyPillButton}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(200,169,106,0.12)";
                      e.currentTarget.style.boxShadow =
                        "0 0 16px rgba(200,169,106,0.35)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    + Reply
                  </button>

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
                    style={replyPillButton}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(200,169,106,0.12)";
                      e.currentTarget.style.boxShadow =
                        "0 0 16px rgba(200,169,106,0.35)";
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
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "#C8A96A",
                                  marginTop: "4px",
                                }}
                              >
                                ✎ Edited {formatDateTime(reply.edited_at)}
                              </div>
                            ) : null}
                          </div>
                          <div
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
                                onClick={() => {
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
                                onClick={() => deleteReply(reply.id)}
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
               {expandedReplyEntry === entry.id && (
  <div className="reply-input-wrap" style={replyInputWrap}>
   

    <textarea
  value={replyMessages[entry.id] || ""}
  onChange={(e) =>
    setReplyMessages((prev) => ({
      ...prev,
      [entry.id]: e.target.value,
    }))
  }
  placeholder="Write a reply..."
  className="one-eyrie-field"
  style={replyTextarea}
/>

<div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "10px",
    alignItems: "center",
    flexWrap: "wrap",
  }}
>
  <button
    type="button"
    onClick={() => addInlineReply(entry.id)}
    className="plus-submit"
    style={replySendButton}
  >
    Send Reply
  </button>
</div>
  </div>
)}

{entry.pass_on_log_views?.length > 0 && (
  <div style={viewedByRow}>
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

const goldButton: React.CSSProperties = {
  background: gold,
  color: "#111111",
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "all 0.18s ease",
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
  alignItems: "stretch",
  width: "100%",
  background: ONE_EYRIE.surface,
  border: `1px solid rgba(200, 169, 106, 0.35)`,
  borderRadius: "14px",
  padding: "10px",
  transition: "all 0.18s ease",
  boxSizing: "border-box",
};

const replyTextarea: React.CSSProperties = {
  ...textareaStyle,
  flex: 1,
  minHeight: "70px",
  fontSize: "14px",
  marginRight: "8px",
};

const smallPlusButton: React.CSSProperties = {
  width: "42px",
  height: "42px",
  borderRadius: "10px",
  border: `1px solid ${gold}`,
  background: "transparent",
  color: gold,
  fontSize: "26px",
  cursor: "pointer",
  transition: "all 0.18s ease",
  marginLeft: "8px",
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

const modalOverlay = ONE_EYRIE_MODAL_OVERLAY;
const modalBox = ONE_EYRIE_MODAL_BOX;
const modalHeader = ONE_EYRIE_MODAL_HEADER;
const closeButton = ONE_EYRIE_MODAL_CLOSE_BUTTON;

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
  background: "transparent",
  border: "1px solid #C8A96A",
  color: gold,

  borderRadius: "16px",
  padding: "8px 14px",
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontSize: "11px",
  alignSelf: "center",
  display: "inline-flex",
  
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
  transition: "all 0.18s ease"
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
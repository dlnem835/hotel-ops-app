"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Search, Plus, Trash2, Edit2, Eye, MessageCircle } from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const gold = "#C8A96A";

export default function PassOnLogPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expandedViewsEntry, setExpandedViewsEntry] = useState<number | null>(null);
  const [expandedReplyEntry, setExpandedReplyEntry] = useState<number | null>(null);
  const [replyMessages, setReplyMessages] = useState<Record<number, string>>({});

  async function fetchEntries() {
    const { data } = await supabase
      .from("pass_on_log")
      .select("*, pass_on_log_replies(*), pass_on_log_views(*)")
      .order("created_at", { ascending: false });

    setEntries(data || []);
  }

  useEffect(() => {
    fetchEntries();
  }, []);

  async function addEntry(e: any) {
    e.preventDefault();

    if (!subject || !message) {
      alert("Please enter a subject and message.");
      return;
    }

    const { error } = await supabase.from("pass_on_log").insert([
      {
        subject,
        author: "Douglas",
        priority,
        message,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setSubject("");
    setPriority("Normal");
    setMessage("");
    setShowForm(false);
    fetchEntries();
  }

  async function toggleViews(entryId: number) {
    const viewerName = "Douglas";

    const { data: existingView } = await supabase
      .from("pass_on_log_views")
      .select("*")
      .eq("entry_id", entryId)
      .eq("viewer_name", viewerName)
      .maybeSingle();

    if (!existingView) {
      await supabase.from("pass_on_log_views").insert([
        {
          entry_id: entryId,
          viewer_name: viewerName,
        },
      ]);
    }

    setExpandedViewsEntry(expandedViewsEntry === entryId ? null : entryId);
    fetchEntries();
  }

  async function addInlineReply(entryId: number) {
    const text = replyMessages[entryId]?.trim();

    if (!text) return;

    await supabase.from("pass_on_log_replies").insert([
      {
        entry_id: entryId,
        reply_author: "Douglas",
        reply_message: text,
      },
    ]);

    setReplyMessages((prev) => ({ ...prev, [entryId]: "" }));
    fetchEntries();
  }

  async function deleteEntry(id: number) {
    if (!confirm("Delete this pass-on entry?")) return;

    await supabase.from("pass_on_log").delete().eq("id", id);
    fetchEntries();
  }

  const filteredEntries = entries.filter((entry) =>
    `${entry.subject} ${entry.author} ${entry.message} ${entry.priority}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main style={mainStyle}>
      <style>
        {`
          .nav-item:hover {
            background: rgba(200, 169, 106, 0.14) !important;
            color: #C8A96A !important;
          }

          .entry-card {
            transition: all 0.18s ease;
          }

          .entry-card:hover {
            border-color: rgba(200, 169, 106, 0.55) !important;
            transform: translateY(-1px);
            box-shadow: 0 18px 48px rgba(0,0,0,0.42);
          }

          .icon-button:hover {
            border-color: rgba(200, 169, 106, 0.75) !important;
            color: #C8A96A !important;
          }

          .section-button:hover {
            color: #C8A96A !important;
          }

          .new-button:hover,
          .gold-button:hover,
          .plus-submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 22px rgba(200,169,106,0.25);
          }

          .reply-input-wrap:focus-within {
            border-color: rgba(200,169,106,0.75) !important;
            box-shadow: 0 0 0 3px rgba(200,169,106,0.08);
          }
        `}
      </style>

      <aside style={sidebarStyle}>
        <div style={{ marginBottom: "42px" }}>
          <div style={{ color: gold, fontSize: "28px", fontWeight: "bold" }}>
            ONE
          </div>
          <div style={{ color: gold, letterSpacing: "4px", fontSize: "13px" }}>
            — EYRIE —
          </div>
        </div>

        {[
          "Dashboard",
          "Lost & Found",
          "Pass-On Log",
          "Inspections",
          "Maintenance",
          "Settings",
        ].map((item) => (
          <div
            key={item}
            className="nav-item"
            style={{
              padding: "14px 16px",
              borderRadius: "10px",
              marginBottom: "8px",
              background: item === "Pass-On Log" ? gold : "transparent",
              color: item === "Pass-On Log" ? "#111111" : "#FFFFFF",
              fontWeight: item === "Pass-On Log" ? "bold" : "normal",
              transition: "all 0.18s ease",
            }}
          >
            <Link
              href={
                item === "Lost & Found"
                  ? "/"
                  : item === "Pass-On Log"
                  ? "/pass-on-log"
                  : "#"
              }
              style={{
                color: "inherit",
                textDecoration: "none",
                display: "block",
                width: "100%",
              }}
            >
              {item}
            </Link>
          </div>
        ))}
      </aside>

      <section style={{ flex: 1, padding: "34px 40px" }}>
        <div style={{ maxWidth: "1120px", margin: "0 auto" }}>
          <div style={pageHeader}>
            <div>
              <h1 style={{ margin: 0, fontSize: "34px" }}>Pass-On Log</h1>
              <p style={{ marginTop: "6px", color: "#9CA3AF" }}>
                Shift notes and hotel communication
              </p>
            </div>

            <button
              className="new-button"
              style={newButton}
              onClick={() => setShowForm(true)}
            >
              <Plus size={16} /> New
            </button>
          </div>

          <div style={panelStyle}>
            <div style={searchWrap}>
              <Search
                size={22}
                color="#E5E7EB"
                style={{ position: "absolute", left: "22px", top: "19px" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pass-on entries..."
                style={searchInput}
              />
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
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={addEntry} style={formStyle}>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Subject"
                      style={inputStyle}
                    />

                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      style={inputStyle}
                    >
                      <option>Normal</option>
                      <option>Important</option>
                      <option>Urgent</option>
                    </select>

                    <button type="submit" className="gold-button" style={goldButton}>
                      Add Entry
                    </button>

                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write pass-on note..."
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

            <div style={{ marginTop: "26px" }}>
              {!filteredEntries.length ? (
                <p style={{ color: "#9CA3AF" }}>No pass-on entries yet.</p>
              ) : (
                filteredEntries.map((entry) => (
                  <div key={entry.id} className="entry-card" style={entryCard}>
                    <div style={cardTopRow}>
                      <div>
                        <div style={priorityPill(entry.priority)}>
                          {entry.priority || "Normal"}
                        </div>

                        <h3 style={entryTitle}>{entry.subject}</h3>

                        <p style={entryMeta}>
                          {entry.author || "Unknown"} ·{" "}
                          {entry.created_at
                            ? new Date(entry.created_at).toLocaleString()
                            : ""}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="icon-button" style={iconButton}>
                          <Edit2 size={15} />
                        </button>

                        <button
                          className="icon-button"
                          onClick={() => deleteEntry(entry.id)}
                          style={iconButton}
                        >
                          <Trash2 size={15
                          } />
                        </button>
                      </div>
                    </div>


                    <div style={originalPostBox}>
                      {entry.message}
                    </div>

                    {entry.pass_on_log_replies?.length > 0 && (
                      <div style={{ marginTop: "10px" }}>
                        {entry.pass_on_log_replies.map((reply: any) => (
                          <div key={reply.id} style={replyPreviewBox}>
                            <strong>{reply.reply_author}:</strong>{" "}
                            {reply.reply_message}
                          </div>
                        ))}
                      </div>
                    )}

<div style={{
  display: "flex",
  alignItems: "flex-start",
  gap: "34px",
  marginTop: "18px",
}}
>
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleViews(entry.id)}
                          className="section-button"
                          style={sectionButton}
                        >
                        
                          <Eye size={18} />
                          <span>Views</span>
                        </button>

                        {expandedViewsEntry ===entry.id && (
                          <div style={viewsList}>
                            {!entry.pass_on_log_views?.length ? (
                              <div style={{ color: "#9CA3AF" }}>No views yet</div>
                            ) : (
                              entry.pass_on_log_views.map((view: any) => (
                                <div key={view.id} style={viewRow}>
                                  <span style={{ color: "#F4D03F" }}>•</span>
                                  <strong>{view.viewer_name}</strong>
                                  <span>
                                    {new Date(view.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedReplyEntry(
                              expandedReplyEntry === entry.id ? null : entry.id
                            )
                          }
                          className="section-button"
                          style={sectionButton}
                        >
                          <MessageCircle size={18} />
                          <span>Replies</span>
                        </button>

                        {expandedReplyEntry === entry.id && (
                          <div className="reply-input-wrap" style={replyInputWrap}>
                             <textarea
  value={replyMessages[entry.id] || ""}
  onChange={(e) => setReplyMessages((prev) => ({
    ...prev,
    [entry.id]: e.target.value
  }))}
  placeholder="Write a reply..."
  style={{
    width: "100%",
    minHeight: "80px",
    background: "#111111",
    color: "#FFFFFF",
    border: "1px solid #3A3A3A",
    borderRadius: "10px",
    padding: "12px",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box",
    outline: "none",
  }}
></textarea>
                            <button
                              type="button"
                              onClick={() => addInlineReply(entry.id)}
                              className="plus-submit"
                              style={smallPlusButton}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#050505",
  color: "#FFFFFF",
  fontFamily: "Arial, sans-serif",
  display: "flex",
};

const sidebarStyle: React.CSSProperties = {
  width: "245px",
  borderRight: "1px solid #2A2A2A",
  background: "#080808",
  padding: "28px 18px",
};

const pageHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
};

const panelStyle: React.CSSProperties = {
  background: "#0B0B0B",
  border: "1px solid #2A2A2A",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
};

const searchWrap: React.CSSProperties = {
  position: "relative",
  marginBottom: "24px",
};

const searchInput: React.CSSProperties = {
  width: "100%",
  height: "62px",
  background: "#06080C",
  color: "#FFFFFF",
  border: "1px solid #2A3345",
  borderRadius: "16px",
  padding: "0 20px 0 62px",
  outline: "none",
  fontSize: "20px",
  boxSizing: "border-box",
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 130px",
  gap: "12px",
};

const inputStyle: React.CSSProperties = {
  background: "#050505",
  color: "#FFFFFF",
  border: "1px solid #2A2A2A",
  borderRadius: "10px",
  padding: "12px 14px",
  outline: "none",
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

const newButton: React.CSSProperties = {
  background: "transparent",
  color: gold,
  border: `1px solid ${gold}`,
  borderRadius: "999px",
  padding: "10px 16px",
  fontWeight: "bold",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  transition: "all 0.18s ease",
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

const entryCard: React.CSSProperties = {
  background: "linear-gradient(135deg, #161616",
  border: "1px solid #2A3345",
  borderLeft: `4px solid ${gold}`,
  borderRadius: "14px",
  padding: "14px",
  marginBottom: "10px",
};

const cardTopRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "18px",
};

const entryTitle: React.CSSProperties = {
  margin: "16px 0 8px",
  marginBottom: "5px",
  fontSize: "18px",
};

const entryMeta: React.CSSProperties = {
  margin: "0 0 7px",
  color: "#B8C1D1",
  fontSize: "12px",
};

const messageText: React.CSSProperties = {
  margin: "0 0 12px",
  color: "#E5E7EB",
  lineHeight: 1.6,
  fontSize: "10px",
};

const originalPostBox: React.CSSProperties = {
  background: "#0D0D0D",
  borderTop: "1px solid #2A2A2A",
  borderRight: "1px solid #2A2A2A",
  borderBottom: "1px solid #2A2A2A",
  borderLeft: `3px solid ${gold}`,
  borderRadius: "8px",
  padding: "12px 14px",
  color: "#FFFFFF",
  marginTop: "12px",
};

const replyPreviewBox: React.CSSProperties = {
  background: "#0D0D0D",
  border: "1px solid #2A3345",
  borderLeft: "3px solid #6B7280",
  borderRadius: "8px",
  padding: "8px 12px",
  marginBottom: "6px",
  color: "#E5E7EB",
  fontSize: "13px",
  marginLeft: "24px",
};

const interactionGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1px 2fr",
  gap: "34px",
  marginTop: "24px",
  alignItems: "start",
};



const sectionButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  background: "transparent",
  border: "none",
  color: "#FFFFFF",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
  transition: "all 0.18s ease",
};

const viewsList: React.CSSProperties = {
  marginTop: "8px",
  paddingLeft: "-12px",
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
  marginLeft: "5px",
};

const replyInputWrap: React.CSSProperties = {
  marginTop: "10px",
  display: "flex",
  alignItems: "stretch",
  width: "700px",
  background: "#080B10",
  border: "1px solid #2A3345",
  borderRadius: "14px",
  padding: "8px",
  transition: "all 0.18s ease",
};

const replyInput: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  color: "#FFFFFF",
  outline: "none",
  fontSize: "16px",
  padding: "10px 12px",
};

const smallPlusButton: React.CSSProperties = {
  width: "44px",
  height: "44px",
  borderRadius: "10px",
  border: `1px solid ${gold}`,
  background: "transparent",
  color: gold,
  fontSize: "28px",
  cursor: "pointer",
  transition: "all 0.18s ease",
};

function priorityPill(priority: string): React.CSSProperties {
  const color =
    priority === "Urgent"
      ? "#F87171"
      : priority === "Important"
      ? gold
      : "#22C55E";

  return {
    display: "inline-block",
    color,
    border: `1px solid ${color}`,
    borderRadius: "999px",
    padding: "6px 14px",
    fontSize: "13px",
    fontWeight: "bold",
  };
}

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
};

const modalBox: React.CSSProperties = {
  width: "720px",
  maxWidth: "90%",
  background: "#111111",
  border: "1px solid #C8A96A",
  borderRadius: "16px",
  padding: "24px",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
};

const closeButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#FFFFFF",
  fontSize: "28px",
  cursor: "pointer",
};

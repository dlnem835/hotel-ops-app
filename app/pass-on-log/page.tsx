"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Eye, MessageCircle, Trash2 } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const gold = "#C8A96A";

export default function PassOnLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [searchterm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchLogs() {
    const { data } = await supabase
      .from("pass_on_logs")
      .select("*")
      .order("created_at", { ascending: false });

    setLogs(data || []);
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  async function addTestEntry() {
    await supabase.from("pass_on_logs").insert([
      {
        shift: "PM Shift",
        subject: "Guest Concern",
        entry:
          "Mr. Rabsatt in RM 510 stopped by the desk letting me know he noticed a crack across the ceiling and the bathroom fan is loud. Maintenance should check after checkout.",
        priority: "High",
        author: "Front Desk",
        status: "New",
      },
    ]);

    fetchLogs();
  }

  async function deleteLog(id: string) {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("pass_on_logs").delete().eq("id", id);
    fetchLogs();
  }

  const filteredLogs = logs.filter((log) =>
    `${log.shift} ${log.subject} ${log.entry} ${log.author} ${log.priority}`
      .toLowerCase()
      .includes(searchterm.toLowerCase())
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0B0B0B",
        color: "white",
        fontFamily: "Arial, sans-serif",
        display: "flex",
      }}
    >
      <aside
        style={{
          width: "245px",
          borderRight: "1px solid #2A2A2A",
          background: "#080808",
          padding: "28px 18px",
        }}
      >
        <div style={{ marginBottom: "42px" }}>
          <div style={{ color: gold, fontSize: "28px", fontWeight: "bold" }}>
            ONE
          </div>
          <div style={{ color: gold, letterSpacing: "4px", fontSize: "13px" }}>
            — EYRIE —
          </div>
        </div>

        {["Dashboard", "Lost & Found", "Pass-On Log", "Inspections", "Maintenance", "Settings"].map(
          (item) => (
            <div
              key={item}
              style={{
                padding: "14px 16px",
                borderRadius: "10px",
                marginBottom: "8px",
                background: item === "Pass-On Log" ? gold : "transparent",
                color: item === "Pass-On Log" ? "#111" : "#fff",
                fontWeight: item === "Pass-On Log" ? "bold" : "normal",
              }}
            >
              {item}
            </div>
          )
        )}
      </aside>

      <section style={{ flex: 1, padding: "34px 40px" }}>
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ margin: 0, fontSize: "30px" }}>Pass-On Log</h1>
          <p style={{ marginTop: "6px", color: "#9CA3AF" }}>
            Shift notes and hotel communication
          </p>
        </div>

        <div
          style={{
            maxWidth: "1120px",
            margin: "0 auto",
            border: "1px solid #2A2A2A",
            borderRadius: "14px",
            background: "#111111",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "18px",
              borderBottom: "1px solid #2A2A2A",
              display: "flex",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <input
              placeholder="Search by keyword, subject, or employee..."
              value={searchterm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />

            <button onClick={addTestEntry} style={goldButton}>
              + Create Entry
            </button>
          </div>

          <div style={{ padding: "18px" }}>
            <h3 style={{ color: gold, marginTop: 0 }}>Today</h3>

            {!filteredLogs.length ? (
              <p style={{ color: "#9CA3AF" }}>No entries yet.</p>
            ) : (
              filteredLogs.map((log) => {
                const expanded = expandedId === log.id;

                return (
                  <div
                    key={log.id}
                    onClick={() => setExpandedId(expanded ? null : log.id)}
                    style={{
                      border: "1px solid #2A2A2A",
                      borderLeft: `4px solid ${gold}`,
                      borderRadius: "10px",
                      padding: "16px",
                      marginBottom: "12px",
                      cursor: "pointer",
                      background: expanded ? "#1A1A1A" : "#0B0B0B",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{log.shift}</h3>
                        <p style={{ margin: "6px 0", fontWeight: "bold" }}>
                          Subject: {log.subject || "No subject"}
                        </p>
                        <p style={{ margin: 0, color: "#E5E7EB" }}>
                          {expanded
                            ? log.entry
                            : `${log.entry?.slice(0, 130)}${
                                log.entry?.length > 130 ? "..." : ""
                              }`}
                        </p>
                      </div>

                      <div style={{ color: "#9CA3AF", fontSize: "12px" }}>
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", gap: "18px", color: "#9CA3AF" }}>
                        <span>
                          <Eye size={14} /> {log.views || 0}
                        </span>
                        <span>
                          <MessageCircle size={14} /> 0
                        </span>
                        <span>Priority: {log.priority}</span>
                        <span>Author: {log.author || "Not recorded"}</span>
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <button style={smallButton}>Edit</button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLog(log.id);
                          }}
                          style={smallButton}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {expanded && (
                      <div
                        style={{
                          marginTop: "16px",
                          borderTop: "1px solid #2A2A2A",
                          paddingTop: "14px",
                        }}
                      >
                        <p style={{ color: "#9CA3AF", marginBottom: "8px" }}>
                          Viewed by: Not built yet
                        </p>

                        <p style={{ color: "#9CA3AF", marginBottom: "8px" }}>
                          Replies: No replies yet
                        </p>

                        <input
                          placeholder="Write a reply..."
                          style={{ ...inputStyle, width: "100%" }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#0B0B0B",
  color: "#FFFFFF",
  border: "1px solid #2A2A2A",
  borderRadius: "10px",
  padding: "11px 12px",
  outline: "none",
};

const goldButton: React.CSSProperties = {
  background: gold,
  color: "#111111",
  border: "none",
  borderRadius: "10px",
  padding: "11px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const smallButton: React.CSSProperties = {
  background: "transparent",
  color: "#E5E7EB",
  border: "1px solid #2A2A2A",
  borderRadius: "8px",
  padding: "7px 12px",
  cursor: "pointer",
};
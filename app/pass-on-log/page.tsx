"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Search, Plus, Trash2, Edit2 } from "lucide-react";
import Link  from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const gold = "#C8A96A";

export default function PassOnLogPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [author, setAuthor] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [message, setMessage] = useState("");

  async function fetchEntries() {
    const { data } = await supabase
      .from("pass_on_log")
      .select("*")
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
        author,
        priority,
        message,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setSubject("");
    setAuthor("");
    setPriority("Normal");
    setMessage("");
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
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#FFFFFF",
        fontFamily: "Arial, sans-serif",
        display: "flex",
      }}
    >
      <aside style={sidebarStyle}>
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
                color: item === "Pass-On Log" ? "#111111" : "#FFFFFF",
                fontWeight: item === "Pass-On Log" ? "bold" : "normal",
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
          )
        )}
      </aside>

      <section style={{ flex: 1, padding: "34px 40px" }}>
        <div style={{ maxWidth: "980px", margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: "30px" }}>Pass-On Log</h1>
              <p style={{ marginTop: "6px", color: "#9CA3AF" }}>
                Shift notes and hotel communication
              </p>
            </div>

            <button style={newButton}>
              <Plus size={16} /> New
            </button>
          </div>

          <div style={panelStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "20px",
              }}
            >
              <div style={{ position: "relative", flex: 1 }}>
                <Search
                  size={16}
                  color="#9CA3AF"
                  style={{ position: "absolute", left: "14px", top: "14px" }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pass-on entries..."
                  style={{
                    ...inputStyle,
                    width: "100%",
                    paddingLeft: "40px",
                  }}
                />
              </div>
            </div>

            <form onSubmit={addEntry} style={formStyle}>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                style={inputStyle}
              />

              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author"
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

              <button type="submit" style={goldButton}>
                Add Entry
              </button>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write pass-on note..."
                style={{
                  ...inputStyle,
                  gridColumn: "1 / -1",
                  minHeight: "90px",
                  resize: "vertical",
                }}
              />
            </form>

            <div style={{ marginTop: "26px" }}>
              {!filteredEntries.length ? (
                <p style={{ color: "#9CA3AF" }}>No pass-on entries yet.</p>
              ) : (
                filteredEntries.map((entry) => (
                  <div key={entry.id} style={entryCard}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={priorityPill(entry.priority)}>
                          {entry.priority || "Normal"}
                        </div>

                        <h3 style={{ margin: "10px 0 6px" }}>
                          {entry.subject}
                        </h3>

                        <p style={{ margin: "0 0 10px", color: "#9CA3AF" }}>
                          {entry.author || "Unknown"} •{" "}
                          {entry.created_at
                            ? new Date(entry.created_at).toLocaleString()
                            : ""}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button style={iconButton}>
                          <Edit2 size={15} />
                        </button>

                        <button
                          onClick={() => deleteEntry(entry.id)}
                          style={iconButton}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <p style={{ margin: 0, color: "#E5E7EB", lineHeight: 1.6 }}>
                      {entry.message}
                    </p>
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

const sidebarStyle: React.CSSProperties = {
  width: "245px",
  borderRight: "1px solid #2A2A2A",
  background: "#080808",
  padding: "28px 18px",
};

const panelStyle: React.CSSProperties = {
  background: "#0B0B0B",
  border: "1px solid #2A2A2A",
  borderRadius: "18px",
  padding: "24px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 0.8fr 130px",
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
};

const iconButton: React.CSSProperties = {
  background: "transparent",
  color: "#E5E7EB",
  border: "1px solid #2A2A2A",
  borderRadius: "8px",
  padding: "8px",
  cursor: "pointer",
};

const entryCard: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #2A2A2A",
  borderLeft: `4px solid ${gold}`,
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "14px",
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
    padding: "5px 10px",
    fontSize: "12px",
    fontWeight: "bold",
  };
}

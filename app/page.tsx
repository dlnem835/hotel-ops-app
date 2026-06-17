"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import SendLabelRequestForm from "./SendLabelRequestForm";
import { Trash2, Send, Eye, Edit2, SlidersHorizontal, Package } from "lucide-react";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const gold = "#C8A96A";

export default function Home() {
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [searchterm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest");
  const [foundby, setFoundBy] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const readyToShipCount = lostItems.filter(
    (item) => item.status === "Ready to be shipped"
  ).length;

  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const readyToDiscardCount = lostItems.filter(
    (item) => item.created_at && new Date(item.created_at) <= sixMonthsAgo
  ).length;

  const filteredItems = lostItems.filter((item) => {
    const matchesSearch =
      `${item.guest_last_name} ${item.room_number} ${item.item_name} ${item.status}`
        .toLowerCase()
        .includes(searchterm.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const displayItems = [...filteredItems].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();

    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });

  async function fetchItems() {
    const { data } = await supabase
      .from("lost_items")
      .select("*")
      .order("created_at", { ascending: false });

    setLostItems(data || []);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
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
const { data: teamMember } = await supabase
  .from("team_members")
  .select("first_name, last_name, username")
  .eq("auth_user_id", session.user.id)
  .single();

if (teamMember) {
  setCurrentUserName(
    teamMember.username ||
      `${teamMember.first_name || ""} ${teamMember.last_name || ""}`.trim()
  );
}

const { data: allTeamMembers } = await supabase
  .from("team_members")
  .select("auth_user_id, first_name, last_name, username");

setTeamMembers(allTeamMembers || []);
    fetchItems();
  }

  checkAuth();
}, []);

  async function addItem(e: any) {
    e.preventDefault();

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    const {
  data: { session },
} = await supabase.auth.getSession();
    await supabase.from("lost_items").insert([
      {
      
        item_name: formData.get("item_name"),
        room_number: formData.get("room_number"),
        guest_last_name: formData.get("guest_last_name"),
        found_by: foundby,
        status: formData.get("status"),
        created_by: session?.user?.id || null,
      },
    ]);


    form.reset();
    setFoundBy ("");
    fetchItems();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;

    await supabase.from("lost_items").delete().eq("id", id);
    fetchItems();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("lost_items").update({ status }).eq("id", id);
    fetchItems();
  }

  async function updateComments(id: string, comments: string) {
    await supabase.from("lost_items").update({ comments }).eq("id", id);
    fetchItems();
  }

  function statusStyle(status: string) {
    if (status === "Ready to be shipped") {
      return { background: "#14532D", color: "#DCFCE7", border: "1px solid #22C55E" };
    }

    if (status === "Label sent") {
      return { background: "#7C4A03", color: "#FEF3C7", border: "1px solid #C8A96A" };
    }

    if (status === "Stored") {
      return { background: "#333333", color: "#E5E7EB", border: "1px solid #555" };
    }

    return { background: "#1F2937", color: "#E5E7EB", border: "1px solid #374151" };
  }

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
      {/* SIDEBAR */}
      <aside
        style={{
          width: "245px",
          borderRight: "1px solid #2A2A2A",
          background: "#211F1B",
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
                background: item === "Lost & Found" ? gold : "transparent",
                color: item === "Lost & Found" ? "#111" : "#fff",
                fontWeight: item === "Lost & Found" ? "bold" : "normal",
              }}
            >
              <Link
  href={
    item === "Lost & Found"
      ? "/"
      : item === "Pass-On Log"
      ? "/pass-on-log"
      : item === "Settings"
      ? "/settings"
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

      {/* MAIN CONTENT */}
      <section style={{ flex: 1, padding: "34px 40px" }}>
        <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "28px",
  }}
>
  <div>
    <h1 style={{ margin: 0, fontSize: "30px" }}>
      Lost & Found
    </h1>
    <p style={{ marginTop: "6px", color: "#9CA3AF" }}>
      Track, manage, and return guest items
    </p>
  </div>

  <div style={{ textAlign: "right" }}>
    <div style={{ fontWeight: 600 }}>
      {currentUserName}
    </div>

    <button
      onClick={logout}
      style={{
        background: "none",
        border: "none",
        color: "#C8A96A",
        cursor: "pointer",
        padding: 0,
        marginTop: "4px",
      }}
    >
      Logout
    </button>
  </div>
</div>

        {/* STATS */}
        <div style={{ display: "flex", gap: "18px", marginBottom: "22px" }}>
          <div style={cardStyle}>
            <div>
              <p style={cardTitle}>Ready to Ship</p>
              <p style={bigNumber}>{readyToShipCount}</p>
              <p style={mutedText}>Items ready for shipping</p>
            </div>
            <div
  style={{
    ...iconBox,
    background: "rgba(34,197,94,0.12)",
    color: "#22C55E",
    fontSize: "24px",
    boxShadow: "0 0 18px rgba(34,197,94,0.18)",
  }}
>
  📦
</div>
          </div>

          <div style={cardStyle}>
            <div>
              <p style={cardTitle}>Ready to Discard</p>
              <p style={bigNumber}>{readyToDiscardCount}</p>
              <p style={mutedText}>Items older than 6 months</p>
            </div>
            <div
  style={{
    ...iconBox,
    background: "rgba(239,68,68,0.12)",
    color: "#EF4444",
    fontSize: "22px",
    boxShadow: "0 0 18px rgba(239,68,68,0.15)",
  }}
>
  🗑️
</div>
          </div>
        </div>

        {/* ADD ITEM */}
        <form
          onSubmit={addItem}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 0.65fr 1fr .85fr 0.7fr auto",
            gap: "10px",
            marginBottom: "18px",
          }}
        >
          <input name="item_name" placeholder="Item name" required style={inputStyle} />
          <input name="room_number" placeholder="Room #" required style={inputStyle} />
          <input
            name="guest_last_name"
            placeholder="Guest Last Name"
            required
            style={inputStyle}
          />
         <input
  name="found_by"
  type="text"
  placeholder="Found By"
  value={foundby}
  onChange={(e) => setFoundBy(e.target.value)}
  style={inputStyle}
/> 

          <select name="status" defaultValue="Stored" style={inputStyle}>
            <option>Stored</option>
            <option>Ready to be shipped</option>
            <option>Label sent</option>
            <option>Shipped</option>
            <option>Closed</option>
          </select>

          <button
  type="submit"
  style={goldButton}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.04)";
    e.currentTarget.style.boxShadow = "0 0 14px rgba(200,169,106,0.35)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow = "none";
  }}
>
            Add Item
          </button>
        </form>

        {/* SEARCH/FILTER */}
<div style={{ display: "flex", gap: "12px", marginBottom: "18px", alignItems: "center" }}>
  <input
    type="text"
    placeholder="Search guest, room, item, or status..."
    value={searchterm}
    onChange={(e) => setSearchTerm(e.target.value)}
    style={{ ...inputStyle, flex: 1 }}
  />

  <details style={{ position: "relative" }}>
    <summary
      style={{
        listStyle: "none",
        cursor: "pointer",
        height: "48px",
        padding: "0 18px",
        borderRadius: "10px",
        border: "1px solid #C8A96A",
        color: "#fff",
        background: "#111111",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontWeight: "bold",
      }}
    >
      <SlidersHorizontal size={18} />
      Filters
    </summary>

    <div
      style={{
        position: "absolute",
        right: 0,
        top: "56px",
        width: "260px",
        background: "#1A1A1A",
        border: "1px solid #2A2A2A",
        borderRadius: "14px",
        padding: "18px",
        zIndex: 50,
        boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
      }}
    >
      <div style={{ color: "#E5E7EB", fontSize: "12px", fontWeight: "bold", marginBottom: "12px" }}>
        SORT BY
      </div>

      <button onClick={() => setSortOrder("newest")} style={filterMenuButton}>
        Newest First {sortOrder === "newest" ? "✓" : ""}
      </button>

      <button onClick={() => setSortOrder("oldest")} style={filterMenuButton}>
        Oldest First {sortOrder === "oldest" ? "✓" : ""}
      </button>

      <div style={{ height: "1px", background: "#2A2A2A", margin: "14px 0" }} />

      <div style={{ color: "#E5E7EB", fontSize: "12px", fontWeight: "bold", marginBottom: "12px" }}>
        FILTER BY STATUS
      </div>

      {["All", "Stored", "Label sent", "Ready to be shipped", "Shipped", "Closed"].map((status) => (
        <button
          key={status}
          onClick={() => setStatusFilter(status)}
          style={filterMenuButton}
        >
          {status} {statusFilter === status ? "✓" : ""}
        </button>
      ))}
    </div>
  </details>
</div>

  

        {/* TABLE */}
<div
  style={{
    border: "1px solid #2A2A2A",
    borderRadius: "14px",
    overflow: "hidden",
    background: "#111111",
  }}
>
  {!lostItems.length ? (
    <p style={{ padding: "24px", color: "#9CA3AF" }}>No lost items yet.</p>
  ) : !filteredItems.length ? (
    <p style={{ padding: "24px", color: "#9CA3AF" }}>No matching items found.</p>
  ) : (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "13px",
        tableLayout: "auto",
      }}
    >
      <thead>
        <tr
          style={{
            color: "#E5E7EB",
            textAlign: "left",
            borderBottom: "1px solid #2A2A2A",
            textTransform: "uppercase",
            fontSize: "11px",
            letterSpacing: "0.6px",
          }}
        >
          <th style={thStyle}></th>
          <th style={thStyle}>Guest</th>
          <th style={thStyle}>Location</th>
          <th style={thStyle}>Item</th>
          <th style={thStyle}>Status</th>
          <th style={thStyle}>Send Label</th>
          <th style={thStyle}>Date</th>
          <th style={thStyle}>Comments</th>
          <th style={thStyle}>Label</th>
          <th style={{ ...thStyle, textAlign: "center" }}>View Details</th>
        </tr>
      </thead>

      <tbody>
        {displayItems.map((item, index) => (
          <tr
  key={item.id}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.002)";
    e.currentTarget.style.background = "#1B1B1B";
    e.currentTarget.style.boxShadow =
      "0 0 12px rgba(200,169,106,0.10)";
    e.currentTarget.style.position = "relative"
    e.currentTarget.style.zIndex = "5" ;
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.background =
      index % 2 === 0 ? "#302D28" : "#151515";
    e.currentTarget.style.boxShadow = "none";
  }}
  style={{
    borderTop: "1px solid #2A2A2A",
    background: index % 2 === 0 ? "#302D28" : "#151515",
    transition: "all 0.15s ease",
  }}
>
            <td style={tdStyle}>
  <button
    onClick={() => deleteItem(item.id)}
    style={{
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "#9CA3AF",
      padding: 0,
    }}
    title="Delete item"
  >
    <Trash2 size={16} />
  </button>
</td>

            <td style={tdStyle}>{item.guest_last_name}</td>
            <td style={tdStyle}>{item.room_number}</td>
            <td style={tdStyle}>{item.item_name}</td>

            <td style={tdStyle}>
              <select
                value={item.status}
                onChange={(e) => updateStatus(item.id, e.target.value)}
                style={{
                  ...statusStyle(item.status),
                  borderRadius: "999px",
                  padding: "6px 10px",
                  fontWeight: "bold",
                  fontSize: "12px",
                  width: "150px",
                }}
              >
                <option>Stored</option>
                <option>Ready to be shipped</option>
                <option>Label sent</option>
                <option>Shipped</option>
                <option>Closed</option>
              </select>
            </td>

            <td style={tdStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "0px" }}>
                <SendLabelRequestForm itemId={item.id} />
              </div>
            </td>

            <td style={{ ...tdStyle, color: "#E5E7EB", whiteSpace: "nowrap" }}>
              {item.created_at
                ? new Date(item.created_at).toLocaleDateString()
                : "—"}
            </td>

            <td style={tdStyle}>
              <input
                type="text"
                value={item.comments || ""}
                placeholder="Add comment..."
                onChange={(e) => updateComments(item.id, e.target.value)}
                style={{
                  ...inputStyle,
                  width: "180px",
                  padding: "8px 10px",
                }}
              />
            </td>

            <td style={tdStyle}>
              {item.label_url ? (
                <a
                  href={item.label_url}
                  target="_blank"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#E5E7EB",
                    textDecoration: "none",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  <span style={{ color: "#22C55E" }}>✓</span>
                  Label
                </a>
              ) : (
                <span style={{ color: "#6B7280" }}>—</span>
              )}
            </td>

            <td style={{ ...tdStyle, textAlign: "center" }}>
  <button
    onClick={() => setSelectedItem(item)}
    style={{
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "#9CA3AF",
      padding: 0,
    }}
    title="View details"
  >
    <Eye size={18} />
  </button>
</td>
          </tr>
        ))}
      </tbody>
    </table>
  )}
</div>
{selectedItem && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
  >
    <div
      style={{
        background: "#111111",
        border: "1px solid #2A2A2A",
        borderRadius: "16px",
        padding: "24px",
        width: "420px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
      }}
    >
      <h2 style={{ marginTop: 0, color: gold }}>Item Details</h2>

      <p><strong>Guest:</strong> {selectedItem.guest_last_name}</p>
      <p><strong>Location:</strong> {selectedItem.room_number}</p>
      <p><strong>Item:</strong> {selectedItem.item_name}</p>
      <p><strong>Status:</strong> {selectedItem.status}</p>
      <p><strong>Found By:</strong> {selectedItem.found_by || "Not recorded yet"}</p>
      Created By: {
  (() => {
    const member = teamMembers.find(
      (person: any) =>
        String(person.auth_user_id).trim() === String(selectedItem.created_by).trim()
    );

    return member
      ? member.username ||
          `${member.first_name || ""} ${member.last_name || ""}`.trim()
      : "Not recorded yet";
  })()
}
      <p>
  <strong>Date Created:</strong>{" "}
  {selectedItem.created_at
    ? new Date(selectedItem.created_at).toLocaleString()
    : "Not recorded"}
</p>

<p>
  <strong>Label Sent:</strong>{" "}
  {selectedItem.label_sent_at
    ? new Date(selectedItem.label_sent_at).toLocaleString()
    : "Not sent yet"}
</p>

      <button
        onClick={() => setSelectedItem(null)}
        style={{
          marginTop: "16px",
          background: gold,
          color: "#111111",
          border: "none",
          borderRadius: "10px",
          padding: "10px 16px",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        Close
      </button>
    </div>
  </div>
)}
      </section>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  flex: 1,
  background: "linear-gradient(135deg, #211F1B, #211F1B)",
  border: "1px solid #2A2A2A",
  borderRadius: "16px",
  padding: "22px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  fontWeight: "bold",
};

const bigNumber: React.CSSProperties = {
  margin: "10px 0 4px",
  color: gold,
  fontSize: "36px",
  fontWeight: "bold",
};

const mutedText: React.CSSProperties = {
  margin: 0,
  color: "#9CA3AF",
  fontSize: "13px",
};

const iconBox: React.CSSProperties = {
  color: gold,
  fontSize: "24px",
};

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
  borderRadius: "12px",
  padding: "12px 24px",
  minWidth: "120px",
  fontWeight: "14PX",
  letterSpacing: "0.3px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const thStyle: React.CSSProperties = {
  padding: "14px 12px",
  fontSize: "12px",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "16px 14px",
  verticalAlign: "middle",
  fontSize: "13px",
};
const actionMenuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "9px 10px",
  color: "#E5E7EB",
  textDecoration: "none",
  fontSize: "13px",
};

const actionMenuButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  width: "100%",
  padding: "9px 10px",
  background: "transparent",
  border: "none",
  color: "#E5E7EB",
  fontSize: "13px",
  cursor: "pointer",
  textAlign: "left",
};
const filterMenuButton: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  color: "#fff",
  padding: "10px 0",
  textAlign: "left",
  fontSize: "14px",
  fontWeight: "bold",
  cursor: "pointer",
};

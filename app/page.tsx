"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import SendLabelRequestForm from "./SendLabelRequestForm";
import { Trash2, Send, Eye } from "lucide-react";

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

  const readyToShipCount = lostItems.filter(
    (item) => item.status === "Ready to be shipped"
  ).length;

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

  useEffect(() => {
    fetchItems();
  }, []);

  async function addItem(e: any) {
    e.preventDefault();

    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    const { error } = await supabase.from("lost_items").insert([
      {
        item_name: formData.get("item_name"),
        room_number: formData.get("room_number"),
        guest_last_name: formData.get("guest_last_name"),
        status: formData.get("status"),
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    form.reset();
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
                background: item === "Lost & Found" ? gold : "transparent",
                color: item === "Lost & Found" ? "#111" : "#fff",
                fontWeight: item === "Lost & Found" ? "bold" : "normal",
              }}
            >
              {item}
            </div>
          )
        )}
      </aside>

      {/* MAIN CONTENT */}
      <section style={{ flex: 1, padding: "34px 40px" }}>
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ margin: 0, fontSize: "30px" }}>Lost & Found</h1>
          <p style={{ marginTop: "6px", color: "#9CA3AF" }}>
            Track, manage, and return guest items
          </p>
        </div>

        {/* STATS */}
        <div style={{ display: "flex", gap: "18px", marginBottom: "22px" }}>
          <div style={cardStyle}>
            <div>
              <p style={cardTitle}>Ready to Ship</p>
              <p style={bigNumber}>{readyToShipCount}</p>
              <p style={mutedText}>Items ready for shipping</p>
            </div>
            <div style={iconBox}>□</div>
          </div>

          <div style={cardStyle}>
            <div>
              <p style={cardTitle}>Ready to Discard</p>
              <p style={bigNumber}>{readyToDiscardCount}</p>
              <p style={mutedText}>Items older than 6 months</p>
            </div>
            <div style={iconBox}>⌫</div>
          </div>
        </div>

        {/* ADD ITEM */}
        <form
          onSubmit={addItem}
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1.4fr 1.4fr auto",
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

          <select name="status" defaultValue="Stored" style={inputStyle}>
            <option>Stored</option>
            <option>Ready to be shipped</option>
            <option>Label sent</option>
            <option>Shipped</option>
            <option>Closed</option>
          </select>

          <button type="submit" style={goldButton}>
            Add Item
          </button>
        </form>

        {/* SEARCH/FILTER */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "18px" }}>
          <input
            type="text"
            placeholder="Search guest, room, item, or status..."
            value={searchterm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={inputStyle}
          >
            <option>All</option>
            <option>Stored</option>
            <option>Ready to be shipped</option>
            <option>Label sent</option>
            <option>Shipped</option>
            <option>Closed</option>
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={inputStyle}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
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
                fontSize: "14px",
                tableLayout: "fixed",
              }} 
            >
              <thead>
                <tr style={{ color: "#9CA3AF", textAlign: "left" }}>
                  <th style={{ width: "40px" }} aria-label="Delete"></th>
<th style={{ width: "120px" }}>Guest</th>
<th style={{ width: "80px" }}>Room</th>
<th style={{ width: "160px" }}>Item</th>
<th style={{ width: "180px" }}>Status</th>
<th style={{ width: "320px" }}>Send Label</th>
<th style={{ width: "120px" }}>Date Sent</th>
<th style={{ width: "220px" }}>Comments</th>
<th style={{ width: "120px" }}>Label</th>
                </tr>
              </thead>

              <tbody>
                {displayItems.map((item, index) => (
                 <tr
  key={item.id}
  style={{
    borderTop: "1px solid #2A2A2A",
    background: index % 2 === 0 ? "#111111" : "#151515",
  }}
>
  {/* Delete Icon */}
  <td style={tdStyle}>
    <button onClick={() => deleteItem(item.id)} style={{
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: "9CA3AF"
    }}
    >
      🗑
    </button>
  </td>

  {/* Guest */}
  <td style={tdStyle}>{item.guest_last_name}</td>

  {/* Room */}
  <td style={tdStyle}>{item.room_number}</td>

  {/* Item */}
  <td style={tdStyle}>{item.item_name}</td>

  {/* Status */}
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
      }}
    >
      <option>Stored</option>
      <option>Ready to be shipped</option>
      <option>Label sent</option>
      <option>Shipped</option>
      <option>Closed</option>
    </select>
  </td>

  {/* Send Label */}
  <td style={tdStyle}>
  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
    <SendLabelRequestForm itemId={item.id} />
  </div>
</td>

  <td style={{ ...tdStyle, color: "#9CA3AF" }}>
  {item.created_at
    ? new Date(item.created_at).toLocaleDateString()
    : "--"}
</td>

  {/* Comments */}
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

  {/* Label */}
  <td style={tdStyle}>
    {item.label_url ? (
      <a
        href={item.label_url}
        target="_blank"
        style={{ color: "gold", fontWeight: "bold" }}
      >
        View Label
      </a>
    ) : (
      <span style={{ color: "#555" }}>—</span>
    )}
  </td>
</tr>

                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  flex: 1,
  background: "linear-gradient(135deg, #1A1A1A, #111111)",
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
  borderRadius: "10px",
  padding: "11px 18px",
  fontWeight: "bold",
  cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  padding: "14px 12px",
  fontSize: "12px",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 12px",
  verticalAlign: "middle",
};

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import SendLabelRequestForm from "./SendLabelRequestForm";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

  const matchesSearch = `${item.guest_last_name} ${item.room_number} ${item.item_name} ${item.status}`
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
    await supabase
      .from("lost_items")
      .update({
        status,
      })
      .eq("id", id);

    fetchItems();
  }

  async function updateComments(id: string, comments: string) {
  await supabase
    .from("lost_items")
    .update({ comments })
    .eq("id", id);

  fetchItems();
}

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Lost & Found</h1>

<div style={{ display: "flex", gap: "20px", marginBottom: "25px" }}>
  <div
    style={{
      border: "1px solid #555",
      padding: "16px",
      borderRadius: "8px",
      minWidth: "220px",
    }}
  >
    <h3>Ready to Ship</h3>
    <p style={{ fontSize: "28px", fontWeight: "bold" }}>
      {readyToShipCount}
    </p>
  </div>

  <div
    style={{
      border: "1px solid #555",
      padding: "16px",
      borderRadius: "8px",
      minWidth: "220px",
    }}
  >
    <h3>Ready to Discard</h3>
    <p style={{ fontSize: "28px", fontWeight: "bold" }}>
      {readyToDiscardCount}
    </p>
    <p style={{ fontSize: "12px" }}>Items older than 6 months</p>
  </div>
</div>

      <form
        onSubmit={addItem}
        style={{
          marginBottom: "30px",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input name="item_name" placeholder="Item name" required />
        <input name="room_number" placeholder="Room #" required />
        <input name="guest_last_name" placeholder="Guest Last Name" required />

        <select name="status" defaultValue="Stored">
          <option>Stored</option>
          <option>Ready to be shipped</option>
          <option>Label sent</option>
          <option>Shipped</option>
          <option>Closed</option>
        </select>

        <button type="submit">Add Item</button>
      </form>

<input
  type="text"
  placeholder="Search guest, room, item, or status..."
  value={searchterm}
  onChange={(e) => setSearchTerm(e.target.value)}
  style={{
    marginBottom: "20px",
    padding: "8px",
    width: "320px",
  }}
/>

<div style={{ display: "flex", gap: "10px" }}>
  {/* Status Filter */}
  <select
    value={statusFilter}
    onChange={(e) => setStatusFilter(e.target.value)}
    style={{ padding: "8px" }}
  >
    <option>All</option>
    <option>Stored</option>
    <option>Ready to be shipped</option>
    <option>Label sent</option>
    <option>Shipped</option>
    <option>Closed</option>
  </select>

  {/* Sort Dropdown */}
  <select
    value={sortOrder}
    onChange={(e) => setSortOrder(e.target.value)}
    style={{ padding: "8px" }}
  >
    <option value="newest">Newest to Oldest</option>
    <option value="oldest">Oldest to Newest</option>
  </select>
</div>


{!lostItems.length ? (
  <p>No lost items yet.</p>
) : !filteredItems.length ? (
  <p>No matching items found.</p>
) : (
   <table style={{ width: "100%", marginTop: "20px", borderSpacing: "12px" }}>
          <thead>
  <tr>
  <th></th>
  <th>Guest</th>
  <th>Room</th>
  <th>Item</th>
  <th>Status</th>
  <th>Send Label</th>
  <th>Updated</th>
  <th>Label</th>
  <th>Comments</th>
</tr>

</thead>

          <tbody>
            {displayItems.map((item) => (
              <tr key={item.id}>
<td>
  <button
    onClick={() => deleteItem(item.id)}
    style={{
      background: "transparent",
      border: "none",
      color: "red",
      cursor: "pointer",
      fontSize: "16px",
    }}
  >
    ×
  </button>
</td>

  <td>{item.guest_last_name}</td>
  <td>{item.room_number}</td>
  <td>{item.item_name}</td>

  <td>
    <select
      value={item.status}
      onChange={(e) => updateStatus(item.id, e.target.value)}
    >
      <option>Stored</option>
      <option>Ready to be shipped</option>
      <option>Label sent</option>
      <option>Shipped</option>
      <option>Closed</option>
    </select>
  </td>

  {/* Send label ONLY */}
<td>
  <SendLabelRequestForm itemId={item.id} />
</td>

{/* Updated */}
<td>
  {item.created_at
    ? new Date(item.created_at).toLocaleString()
    : "--"}
</td>

{/* View Label */}
<td>
  {item.label_url && (
    <a href={item.label_url} target="_blank">
      View Label
    </a>
  )}
</td>
<td>
  <input
    type="text"
    value={item.comments || ""}
    placeholder="Add note..."
    onChange={(e) => updateComments(item.id, e.target.value)}
    style={{ width: "200px", padding: "6px" }}
  />
</td>
</tr>
            ))}

          </tbody>
        </table>
      )}
    </main>
  );
}

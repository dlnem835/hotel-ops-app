"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import SendLabelRequestForm from "../SendLabelRequestForm";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { Trash2, Send, Eye, Edit2, SlidersHorizontal, Package, Check, X } from "lucide-react";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import { APP_SHELL, APP_SHELL_CLASS, MAIN_CONTENT, MAIN_CONTENT_CLASS } from "@/app/lib/oneEyrieLayout";
import {
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import {
  forestHoverHandlers,
  PRIMARY_BUTTON,
} from "@/app/lib/oneEyrieButtons";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const gold = "#C8A96A";

export default function LostAndFoundPage() {
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
      return {
        background: FOREST.bgSoft,
        color: FOREST.text,
        border: `1px solid ${FOREST.border}`,
      };
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
    <main style={APP_SHELL} className={APP_SHELL_CLASS}>
      <OneEyrieSidebar active="Lost & Found" />

      <section style={MAIN_CONTENT} className={`${MAIN_CONTENT_CLASS} one-eyrie-lost-found-page`}>
        <OneEyriePageHeader
          title="Lost & Found"
          subtitle="Track, manage, and return guest items"
        />

        {/* STATS */}
        <div className="one-eyrie-kpi-row" style={{ marginBottom: "22px" }}>
          <div style={cardStyle}>
            <div>
              <p style={cardTitle}>Ready to Ship</p>
              <p style={bigNumber}>{readyToShipCount}</p>
              <p style={mutedText}>Items ready for shipping</p>
            </div>
            <div
              style={{
                ...iconBox,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Package size={24} strokeWidth={2} color={FOREST.text} />
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 size={22} strokeWidth={2} color={FLAT_RED.text} />
            </div>
          </div>
        </div>

        {/* ADD ITEM */}
        <form onSubmit={addItem} className="one-eyrie-form-grid--lnf-add" style={{ marginBottom: "18px" }}>
          <input name="item_name" placeholder="Item name" required className="one-eyrie-field" style={inputStyle} />
          <input name="room_number" placeholder="Room #" required className="one-eyrie-field" style={inputStyle} />
          <input
            name="guest_last_name"
            placeholder="Guest Last Name"
            required
            className="one-eyrie-field"
            style={inputStyle}
          />
         <input
  name="found_by"
  type="text"
  placeholder="Found By"
  value={foundby}
  onChange={(e) => setFoundBy(e.target.value)}
  className="one-eyrie-field"
  style={inputStyle}
/> 

          <select name="status" defaultValue="Stored" className="one-eyrie-field" style={inputStyle}>
            <option>Stored</option>
            <option>Ready to be shipped</option>
            <option>Label sent</option>
            <option>Shipped</option>
            <option>Closed</option>
          </select>

          <button
            type="submit"
            style={PRIMARY_BUTTON}
            {...forestHoverHandlers()}
          >
            Add Item
          </button>
        </form>

        {/* SEARCH/FILTER */}
        <div className="one-eyrie-toolbar-row" style={{ marginBottom: "18px" }}>
  <input
    type="text"
    placeholder="Search guest, room, item, or status..."
    value={searchterm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="one-eyrie-toolbar-row__grow one-eyrie-field"
    style={inputStyle}
  />

  <details style={{ position: "relative" }}>
    <summary className="one-eyrie-filter-btn">
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

      <button type="button" onClick={() => setSortOrder("newest")} className="one-eyrie-menu-item" style={filterMenuButton}>
        Newest First {sortOrder === "newest" ? <Check size={14} style={{ marginLeft: "6px" }} /> : null}
      </button>

      <button type="button" onClick={() => setSortOrder("oldest")} className="one-eyrie-menu-item" style={filterMenuButton}>
        Oldest First {sortOrder === "oldest" ? <Check size={14} style={{ marginLeft: "6px" }} /> : null}
      </button>

      <div style={{ height: "1px", background: "#2A2A2A", margin: "14px 0" }} />

      <div style={{ color: "#E5E7EB", fontSize: "12px", fontWeight: "bold", marginBottom: "12px" }}>
        FILTER BY STATUS
      </div>

      {["All", "Stored", "Label sent", "Ready to be shipped", "Shipped", "Closed"].map((status) => (
        <button
          key={status}
          type="button"
          onClick={() => setStatusFilter(status)}
          className="one-eyrie-menu-item"
          style={filterMenuButton}
        >
          {status} {statusFilter === status ? <Check size={14} style={{ marginLeft: "6px" }} /> : null}
        </button>
      ))}
    </div>
  </details>
</div>

  

        {/* TABLE */}
        <div className="one-eyrie-table-panel">
  {!lostItems.length ? (
    <p style={{ padding: "24px", color: "#9CA3AF" }}>No lost items yet.</p>
  ) : !filteredItems.length ? (
    <p style={{ padding: "24px", color: "#9CA3AF" }}>No matching items found.</p>
  ) : (
    <table className="one-eyrie-table one-eyrie-table--fit one-eyrie-lnf-table" style={{ fontSize: "13px" }}>
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
          <th className="col-delete" style={thStyle}></th>
          <th className="col-guest" style={thStyle}>Guest</th>
          <th className="col-location" style={thStyle}>Location</th>
          <th className="col-item" style={thStyle}>Item</th>
          <th className="col-status one-eyrie-lnf-status-header" style={thStyle}>Status</th>
          <th className="col-send-label one-eyrie-table__cell--wrap" style={thStyle}>Send Label</th>
          <th className="col-date" style={thStyle}>Date</th>
          <th className="col-comments one-eyrie-table__cell--wrap" style={thStyle}>Comments</th>
          <th className="col-label" style={thStyle}>Label</th>
          <th className="col-view one-eyrie-table__cell--actions" style={{ ...thStyle, textAlign: "center" }}>View</th>
        </tr>
      </thead>

      <tbody>
        {displayItems.map((item) => (
          <tr
            key={item.id}
            className={
              selectedItem?.id === item.id
                ? "one-eyrie-table-row one-eyrie-table-row--selected"
                : "one-eyrie-table-row"
            }
          >
            <td className="col-delete one-eyrie-table__cell--actions" style={tdStyle}>
  <button
    type="button"
    onClick={() => deleteItem(item.id)}
    className="one-eyrie-icon-btn"
    title="Delete item"
  >
    <Trash2 size={16} />
  </button>
</td>

            <td className="col-guest one-eyrie-truncate" style={tdStyle} title={item.guest_last_name}>
              {item.guest_last_name}
            </td>
            <td className="col-location one-eyrie-truncate" style={tdStyle} title={item.room_number}>
              {item.room_number}
            </td>
            <td className="col-item one-eyrie-truncate" style={tdStyle} title={item.item_name}>
              {item.item_name}
            </td>

            <td className="col-status one-eyrie-table__cell--wrap one-eyrie-lnf-status-cell" style={tdStyle}>
              <div
                className="one-eyrie-lnf-status-select-wrap"
                style={statusStyle(item.status)}
              >
                <select
                  value={item.status}
                  onChange={(e) => updateStatus(item.id, e.target.value)}
                  className="one-eyrie-lnf-status-select"
                  aria-label={`Status for ${item.item_name}`}
                >
                  <option>Stored</option>
                  <option>Ready to be shipped</option>
                  <option>Label sent</option>
                  <option>Shipped</option>
                  <option>Closed</option>
                </select>
              </div>
            </td>

            <td className="col-send-label one-eyrie-table__cell--wrap" style={tdStyle}>
              <SendLabelRequestForm itemId={item.id} />
            </td>

            <td className="col-date" style={{ ...tdStyle, color: "#E5E7EB" }} title={item.created_at ? new Date(item.created_at).toLocaleDateString() : undefined}>
              {item.created_at
                ? new Date(item.created_at).toLocaleDateString()
                : "—"}
            </td>

            <td className="col-comments one-eyrie-table__cell--wrap" style={tdStyle}>
              <input
                type="text"
                value={item.comments || ""}
                placeholder="Add comment..."
                onChange={(e) => updateComments(item.id, e.target.value)}
                className="one-eyrie-field one-eyrie-field--compact"
                style={{
                  ...inputStyle,
                  padding: "8px 10px",
                }}
              />
            </td>

            <td className="col-label one-eyrie-truncate" style={tdStyle}>
              {item.label_url ? (
                <a
                  href={item.label_url}
                  target="_blank"
                  title="View label"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    color: ONE_EYRIE.text,
                    textDecoration: "none",
                    fontWeight: "bold",
                    fontSize: "12px",
                  }}
                >
                  <Check size={14} color={FOREST.border} strokeWidth={2.5} />
                  Label
                </a>
              ) : (
                <span style={{ color: "#6B7280" }}>—</span>
              )}
            </td>

            <td className="col-view one-eyrie-table__cell--actions" style={{ ...tdStyle, textAlign: "center" }}>
  <button
    type="button"
    onClick={() => setSelectedItem(item)}
    className="one-eyrie-icon-btn"
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
    style={ONE_EYRIE_MODAL_OVERLAY}
    onClick={() => setSelectedItem(null)}
  >
    <div
      style={{ ...ONE_EYRIE_MODAL_BOX, width: "480px" }}
      onClick={(event) => event.stopPropagation()}
    >
      <div style={ONE_EYRIE_MODAL_HEADER}>
        <h2 style={{ margin: 0, color: gold }}>Item Details</h2>
        <button
          type="button"
          onClick={() => setSelectedItem(null)}
          style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>

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
        type="button"
        onClick={() => setSelectedItem(null)}
        style={{ ...PRIMARY_BUTTON, height: "auto", padding: "10px 16px", marginTop: "16px" }}
        {...forestHoverHandlers()}
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
  background: ONE_EYRIE.listRow,
  border: `1px solid ${ONE_EYRIE.border}`,
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
  padding: "11px 12px",
  outline: "none",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
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
  padding: 0,
  textAlign: "left",
  fontSize: "14px",
  fontWeight: "bold",
  cursor: "pointer",
};

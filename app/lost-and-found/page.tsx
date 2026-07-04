"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import SendLabelRequestForm from "../SendLabelRequestForm";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { Trash2, Eye, SlidersHorizontal, Package, Check, X, Plus, Search } from "lucide-react";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import OneEyrieDesktopHeaderActions from "@/app/components/OneEyrieDesktopHeaderActions";
import LostFoundCommentCell from "@/app/lost-and-found/components/LostFoundCommentCell";
import LostFoundAddItemModal, {
  combineLostFoundLocation,
  type LostFoundAddItemFormData,
} from "@/app/lost-and-found/components/LostFoundAddItemModal";
import { APP_SHELL, APP_SHELL_CLASS, MAIN_CONTENT, MAIN_CONTENT_CLASS } from "@/app/lib/oneEyrieLayout";
import {
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import {
  forestHoverHandlers,
  NEUTRAL_BUTTON,
  neutralHoverHandlers,
  START_WORK_BUTTON,
} from "@/app/lib/oneEyrieButtons";
import "./lost-and-found-responsive.css";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const gold = "#C8A96A";

type LnfSortOrder = "newest" | "oldest" | "guest-az" | "guest-za";
type LnfKpiFilter = "ready-to-ship" | "ready-to-discard";

const STATUS_FILTER_OPTIONS = [
  { label: "All", value: "All" },
  { label: "Stored", value: "Stored" },
  { label: "Label Sent", value: "Label sent" },
  { label: "Ready to be Shipped", value: "Ready to be shipped" },
  { label: "Shipped", value: "Shipped" },
  { label: "Closed", value: "Closed" },
] as const;

const SORT_OPTIONS: { label: string; value: LnfSortOrder }[] = [
  { label: "Newest First", value: "newest" },
  { label: "Oldest First", value: "oldest" },
  { label: "Guest A–Z", value: "guest-az" },
  { label: "Guest Z–A", value: "guest-za" },
];

function getDiscardCutoffDate(): Date {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  return cutoff;
}

function isEligibleForDiscard(item: { created_at?: string | null }, cutoff: Date): boolean {
  return Boolean(item.created_at && new Date(item.created_at) <= cutoff);
}

export default function LostAndFoundPage() {
  const [lostItems, setLostItems] = useState<any[]>([]);
  const [searchterm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState<LnfSortOrder>("newest");
  const [kpiFilter, setKpiFilter] = useState<LnfKpiFilter | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersDropdownRef = useRef<HTMLDivElement>(null);

  const readyToShipCount = lostItems.filter(
    (item) => item.status === "Ready to be shipped"
  ).length;

  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const discardCutoff = getDiscardCutoffDate();

  const readyToDiscardCount = lostItems.filter((item) =>
    isEligibleForDiscard(item, discardCutoff)
  ).length;

  const filteredItems = lostItems.filter((item) => {
    const matchesSearch =
      `${item.guest_last_name} ${item.room_number} ${item.item_name} ${item.status}`
        .toLowerCase()
        .includes(searchterm.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || item.status === statusFilter;

    const matchesKpi =
      kpiFilter === null
        ? true
        : kpiFilter === "ready-to-ship"
          ? item.status === "Ready to be shipped"
          : isEligibleForDiscard(item, discardCutoff);

    return matchesSearch && matchesStatus && matchesKpi;
  });

  const displayItems = [...filteredItems].sort((a, b) => {
    if (sortOrder === "guest-az" || sortOrder === "guest-za") {
      const nameA = String(a.guest_last_name || "").toLowerCase();
      const nameB = String(b.guest_last_name || "").toLowerCase();
      const comparison = nameA.localeCompare(nameB);
      return sortOrder === "guest-az" ? comparison : -comparison;
    }

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

  useEffect(() => {
    if (!successToast) return;
    const timer = window.setTimeout(() => setSuccessToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [successToast]);

  useEffect(() => {
    if (!filtersOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        filtersDropdownRef.current &&
        !filtersDropdownRef.current.contains(target)
      ) {
        setFiltersOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  async function submitNewItem(data: LostFoundAddItemFormData, keepOpen: boolean) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const insertPayload: Record<string, string | null> = {
      item_name: data.item_name,
      room_number: combineLostFoundLocation(data.room_number, data.other_location),
      guest_last_name: data.guest_last_name,
      found_by: data.found_by,
      status: data.status,
      created_by: session?.user?.id || null,
    };

    if (data.comments) {
      insertPayload.comments = data.comments;
    }

    const { error } = await supabase.from("lost_items").insert([insertPayload]);

    if (error) {
      alert("Unable to add item.");
      return false;
    }

    await fetchItems();

    if (!keepOpen) {
      setShowAddModal(false);
    }

    setSuccessToast("Item added successfully.");
    return true;
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

  async function updateComments(id: string | number, comments: string) {
    const { error } = await supabase
      .from("lost_items")
      .update({ comments })
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    setLostItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, comments } : item))
    );
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

  function statusPillClass(status: string): string {
    if (status === "Ready to be shipped") return "lnf-status-pill--ready-ship";
    if (status === "Label sent") return "lnf-status-pill--label-sent";
    if (status === "Stored") return "lnf-status-pill--stored";
    return "lnf-status-pill--default";
  }

  function handleKpiFilter(filter: LnfKpiFilter) {
    setKpiFilter((current) => (current === filter ? null : filter));
    setStatusFilter("All");
  }

  function handleStatusFilter(status: string) {
    setStatusFilter(status);
    setKpiFilter(null);
  }

  function clearKpiFilter() {
    setKpiFilter(null);
  }

  const activeKpiLabel =
    kpiFilter === "ready-to-ship"
      ? "Ready to Ship"
      : kpiFilter === "ready-to-discard"
        ? "Ready to Discard"
        : null;

  return (
    <main style={APP_SHELL} className={APP_SHELL_CLASS}>
      <OneEyrieSidebar active="Lost & Found" />

      <section style={MAIN_CONTENT} className={`${MAIN_CONTENT_CLASS} one-eyrie-lost-found-page`}>
        <OneEyriePageHeader
          title="Lost & Found"
          subtitle="Track, manage, and return guest items"
          actions={
            <OneEyrieDesktopHeaderActions>
              <button
                type="button"
                style={START_WORK_BUTTON}
                className="one-eyrie-btn one-eyrie-btn--start-work one-eyrie-btn--lg"
                onClick={() => setShowAddModal(true)}
                {...forestHoverHandlers()}
              >
                <Plus size={18} />
                Add Item
              </button>
            </OneEyrieDesktopHeaderActions>
          }
        />

        {/* STATS */}
        <div className="one-eyrie-kpi-row" style={{ marginBottom: "22px" }}>
          <button
            type="button"
            className={`lnf-kpi-card lnf-kpi-card--ready-ship${
              kpiFilter === "ready-to-ship" ? " lnf-kpi-card--active" : ""
            }`}
            style={kpiCardButtonStyle}
            onClick={() => handleKpiFilter("ready-to-ship")}
            aria-pressed={kpiFilter === "ready-to-ship"}
          >
            <div>
              <p className="lnf-kpi-card__title" style={cardTitle}>Ready to Ship</p>
              <p className="lnf-kpi-card__value" style={bigNumber}>{readyToShipCount}</p>
              <p className="lnf-kpi-card__muted" style={mutedText}>Items ready for shipping</p>
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
          </button>

          <button
            type="button"
            className={`lnf-kpi-card lnf-kpi-card--discard${
              kpiFilter === "ready-to-discard" ? " lnf-kpi-card--active" : ""
            }`}
            style={kpiCardButtonStyle}
            onClick={() => handleKpiFilter("ready-to-discard")}
            aria-pressed={kpiFilter === "ready-to-discard"}
          >
            <div>
              <p className="lnf-kpi-card__title" style={cardTitle}>Ready to Discard</p>
              <p className="lnf-kpi-card__value" style={bigNumber}>{readyToDiscardCount}</p>
              <p className="lnf-kpi-card__muted" style={mutedText}>Items older than 6 months</p>
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
          </button>
        </div>

        {/* SEARCH/FILTER */}
        <div className="one-eyrie-toolbar-row" style={{ marginBottom: "18px" }}>
  <div className="one-eyrie-toolbar-row__grow lnf-search-wrap">
    <Search
      size={18}
      className="lnf-search-wrap__icon"
      aria-hidden
    />
    <input
      type="text"
      placeholder="Search guest, room, item, or status..."
      value={searchterm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="one-eyrie-field"
      style={searchInputStyle}
    />
  </div>

  <div
    ref={filtersDropdownRef}
    className="lnf-filters-dropdown"
    style={{ position: "relative" }}
  >
    <button
      type="button"
      className="one-eyrie-filter-btn"
      onClick={() => setFiltersOpen((open) => !open)}
      aria-expanded={filtersOpen}
      aria-haspopup="true"
    >
      <SlidersHorizontal size={18} />
      Filters
    </button>

    {filtersOpen ? (
    <div
      className="lnf-filter-menu"
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
      <div className="lnf-filter-menu__heading" style={{ color: "#E5E7EB", fontSize: "12px", fontWeight: "bold", marginBottom: "12px" }}>
        Sort
      </div>

      {SORT_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setSortOrder(option.value)}
          className="one-eyrie-menu-item"
          style={filterMenuButton}
        >
          {option.label} {sortOrder === option.value ? <Check size={14} style={{ marginLeft: "6px" }} /> : null}
        </button>
      ))}

      <div className="lnf-filter-menu__divider" style={{ height: "1px", background: "#2A2A2A", margin: "14px 0" }} />

      <div className="lnf-filter-menu__heading" style={{ color: "#E5E7EB", fontSize: "12px", fontWeight: "bold", marginBottom: "12px" }}>
        Filter by Status
      </div>

      {STATUS_FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => handleStatusFilter(option.value)}
          className="one-eyrie-menu-item"
          style={filterMenuButton}
        >
          {option.label} {statusFilter === option.value ? <Check size={14} style={{ marginLeft: "6px" }} /> : null}
        </button>
      ))}
    </div>
    ) : null}
  </div>
</div>

        {activeKpiLabel ? (
          <div className="lnf-active-filter-pill" style={{ marginBottom: "12px" }}>
            <span>Showing: {activeKpiLabel}</span>
            <button
              type="button"
              className="lnf-active-filter-pill__clear"
              onClick={clearKpiFilter}
              aria-label={`Clear ${activeKpiLabel} filter`}
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ) : null}

        {/* TABLE */}
        <div className="one-eyrie-table-panel">
  {!lostItems.length ? (
    <p className="lnf-empty-text" style={{ padding: "24px 0", color: "#9CA3AF" }}>No lost items yet.</p>
  ) : !filteredItems.length ? (
    <p className="lnf-empty-text" style={{ padding: "24px 0", color: "#9CA3AF" }}>No matching items found.</p>
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
                className={`one-eyrie-lnf-status-select-wrap ${statusPillClass(item.status)}`}
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
              <LostFoundCommentCell
                itemId={item.id}
                comments={item.comments}
                onSave={updateComments}
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
        style={{ ...NEUTRAL_BUTTON, marginTop: "16px" }}
        className="one-eyrie-btn one-eyrie-btn--neutral one-eyrie-btn--md"
        {...neutralHoverHandlers()}
      >
        Close
      </button>
    </div>
  </div>
)}
        <LostFoundAddItemModal
          open={showAddModal}
          defaultFoundBy={currentUserName}
          onClose={() => setShowAddModal(false)}
          onSubmit={submitNewItem}
        />

        {successToast ? (
          <div
            role="status"
            aria-live="polite"
            className="lnf-success-toast"
            style={{
              position: "fixed",
              bottom: "28px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              padding: "12px 18px",
              borderRadius: "10px",
              border: `1px solid ${gold}`,
              background: "#1a1815",
              color: gold,
              fontSize: "13px",
              fontWeight: 700,
              boxShadow: "0 10px 28px rgba(0, 0, 0, 0.45)",
            }}
          >
            {successToast}
          </div>
        ) : null}
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

const kpiCardButtonStyle: React.CSSProperties = {
  ...cardStyle,
  cursor: "pointer",
  font: "inherit",
  color: "inherit",
  textAlign: "left",
  width: "100%",
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

const searchInputStyle: React.CSSProperties = {
  ...inputStyle,
  paddingLeft: "42px",
};

const thStyle: React.CSSProperties = {
  padding: "9px 8px",
  fontSize: "12px",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
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

"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { Eye, SlidersHorizontal, Package, Trash2, X, Plus, Search, Check } from "lucide-react";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import OneEyrieDesktopHeaderActions from "@/app/components/OneEyrieDesktopHeaderActions";
import LostFoundCommentCell from "@/app/lost-and-found/components/LostFoundCommentCell";
import LostFoundAddItemModal, {
  combineLostFoundLocation,
  type LostFoundAddItemFormData,
} from "@/app/lost-and-found/components/LostFoundAddItemModal";
import LostFoundShippingSection from "@/app/lost-and-found/components/LostFoundShippingSection";
import LostFoundItemActionsMenu from "@/app/lost-and-found/components/LostFoundItemActionsMenu";
import SendShippingRequestModal from "@/app/lost-and-found/components/SendShippingRequestModal";
import { formatLostFoundLocationDisplay } from "@/app/lost-and-found/lib/format-location-display";
import {
  LOST_ITEM_STATUS,
  LOST_ITEM_STATUS_OPTIONS,
  normalizeLostItemStatus,
} from "@/app/lib/lost-found-shipping/status";
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
  ...LOST_ITEM_STATUS_OPTIONS.map((status) => ({
    label: status,
    value: status,
  })),
] as const;

function displayItemStatus(status: string | null | undefined): string {
  return normalizeLostItemStatus(status) || String(status || LOST_ITEM_STATUS.stored);
}

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
  const [actionError, setActionError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersDropdownRef = useRef<HTMLDivElement>(null);
  const [actionsMenuItemId, setActionsMenuItemId] = useState<number | string | null>(
    null
  );
  const [sendModalItem, setSendModalItem] = useState<any | null>(null);
  const [commentEditItem, setCommentEditItem] = useState<any | null>(null);
  const [canDeleteItems, setCanDeleteItems] = useState(false);

  const readyToShipCount = lostItems.filter(
    (item) => displayItemStatus(item.status) === LOST_ITEM_STATUS.readyToShip
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
      statusFilter === "All" ||
      displayItemStatus(item.status) === statusFilter;

    const matchesKpi =
      kpiFilter === null
        ? true
        : kpiFilter === "ready-to-ship"
          ? displayItemStatus(item.status) === LOST_ITEM_STATUS.readyToShip
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
    const res = await tenantFetch("/api/lost-and-found");
    if (!res.ok) {
      setLostItems([]);
      return;
    }
    const data = await res.json();
    const items = data.items || [];
    setLostItems(items);
    setSelectedItem((current: { id?: number } | null) => {
      if (!current?.id) return current;
      return items.find((item: { id: number }) => item.id === current.id) || current;
    });
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
    try {
      const accessRes = await tenantFetch("/api/org-admin/access");
      const access = await accessRes.json().catch(() => ({}));
      setCanDeleteItems(Boolean(access.hasAccess));
    } catch {
      setCanDeleteItems(false);
    }
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
    if (!actionError) return;
    const timer = window.setTimeout(() => setActionError(null), 4200);
    return () => window.clearTimeout(timer);
  }, [actionError]);

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
    const body = {
      item_name: data.item_name,
      room_number: combineLostFoundLocation(data.room_number, data.other_location),
      guest_last_name: data.guest_last_name,
      found_by: data.found_by,
      status: data.status,
      comments: data.comments || null,
    };

    const res = await tenantFetch("/api/lost-and-found", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
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

  async function updateStatus(id: string, status: string) {
    await tenantFetch(`/api/lost-and-found/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchItems();
  }

  async function updateComments(id: string | number, comments: string) {
    const res = await tenantFetch(`/api/lost-and-found/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update comments");
    }

    setLostItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, comments } : item))
    );
  }

  function statusStyle(status: string) {
    const normalized = displayItemStatus(status);
    if (normalized === LOST_ITEM_STATUS.readyToShip) {
      return {
        background: FOREST.bgSoft,
        color: FOREST.text,
        border: `1px solid ${FOREST.border}`,
      };
    }

    if (normalized === LOST_ITEM_STATUS.awaitingGuestAction) {
      return { background: "#3B2F14", color: "#FDE68A", border: "1px solid #C8A96A" };
    }

    if (normalized === LOST_ITEM_STATUS.stored) {
      return { background: "#333333", color: "#E5E7EB", border: "1px solid #555" };
    }

    if (normalized === LOST_ITEM_STATUS.shipped) {
      return { background: "#1E3A5F", color: "#BFDBFE", border: "1px solid #60A5FA" };
    }

    if (normalized === LOST_ITEM_STATUS.delivered) {
      return { background: "#1E3A2F", color: "#BBF7D0", border: "1px solid #4ADE80" };
    }

    if (normalized === LOST_ITEM_STATUS.discarded) {
      return { background: "#3F1D1D", color: "#FECACA", border: "1px solid #F87171" };
    }

    return { background: "#1F2937", color: "#E5E7EB", border: "1px solid #374151" };
  }

  function statusPillClass(status: string): string {
    const normalized = displayItemStatus(status);
    if (normalized === LOST_ITEM_STATUS.readyToShip) return "lnf-status-pill--ready-ship";
    if (normalized === LOST_ITEM_STATUS.awaitingGuestAction) {
      return "lnf-status-pill--label-sent";
    }
    if (normalized === LOST_ITEM_STATUS.stored) return "lnf-status-pill--stored";
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
          <th className="col-guest" style={thStyle}>Guest</th>
          <th className="col-location" style={thStyle}>Location</th>
          <th className="col-item" style={thStyle}>Item</th>
          <th className="col-status one-eyrie-lnf-status-header" style={thStyle}>Status</th>
          <th className="col-date" style={thStyle}>Date</th>
          <th className="col-view one-eyrie-table__cell--actions" style={{ ...thStyle, textAlign: "center" }}>View</th>
          <th className="col-actions one-eyrie-table__cell--actions" style={{ ...thStyle, textAlign: "center" }}>Actions</th>
        </tr>
      </thead>

      <tbody>
        {displayItems.map((item) => {
          const locationDisplay = formatLostFoundLocationDisplay(item.room_number);
          return (
          <tr
            key={item.id}
            className={
              selectedItem?.id === item.id
                ? "one-eyrie-table-row one-eyrie-table-row--selected"
                : "one-eyrie-table-row"
            }
          >
            <td
              className="col-guest one-eyrie-truncate"
              style={tdStyle}
              title={item.guest_last_name || undefined}
            >
              {item.guest_last_name}
            </td>
            <td
              className="col-location one-eyrie-truncate"
              style={tdStyle}
              title={locationDisplay || undefined}
            >
              {locationDisplay}
            </td>
            <td
              className="col-item one-eyrie-truncate"
              style={tdStyle}
              title={item.item_name || undefined}
            >
              {item.item_name}
            </td>

            <td className="col-status one-eyrie-table__cell--wrap one-eyrie-lnf-status-cell" style={tdStyle}>
              <div
                className={`one-eyrie-lnf-status-select-wrap ${statusPillClass(item.status)}`}
                style={statusStyle(item.status)}
              >
                <select
                  value={displayItemStatus(item.status)}
                  onChange={(e) => updateStatus(item.id, e.target.value)}
                  className="one-eyrie-lnf-status-select"
                  aria-label={`Status for ${item.item_name}`}
                >
                  {LOST_ITEM_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </td>

            <td className="col-date" style={{ ...tdStyle, color: "#E5E7EB" }} title={item.created_at ? new Date(item.created_at).toLocaleDateString() : undefined}>
              {item.created_at
                ? new Date(item.created_at).toLocaleDateString()
                : "—"}
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

            <td className="col-actions one-eyrie-table__cell--actions" style={{ ...tdStyle, textAlign: "center" }}>
              <LostFoundItemActionsMenu
                item={item}
                open={actionsMenuItemId === item.id}
                onOpenChange={(nextOpen) =>
                  setActionsMenuItemId(nextOpen ? item.id : null)
                }
                onSendShippingRequest={() => setSendModalItem(item)}
                onEditComment={() => setCommentEditItem(item)}
                onDeleted={() => {
                  void fetchItems();
                  setSelectedItem((current: any | null) =>
                    current && String(current.id) === String(item.id)
                      ? null
                      : current
                  );
                }}
                onRefresh={() => {
                  void fetchItems();
                }}
                onError={(message) => setActionError(message)}
                onToast={(message) => setSuccessToast(message)}
                canDelete={canDeleteItems}
              />
            </td>
          </tr>
          );
        })}
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
      className="lnf-item-details-modal"
      style={{
        ...ONE_EYRIE_MODAL_BOX,
        width: "720px",
        minWidth: "min(720px, calc(100vw - 24px))",
        minHeight: "620px",
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "86vh",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="lnf-item-details-modal__header"
        style={{
          ...ONE_EYRIE_MODAL_HEADER,
          marginBottom: 0,
          padding: "18px 20px 14px",
          borderBottom: `1px solid ${ONE_EYRIE.borderDivider}`,
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, color: gold, fontSize: "18px" }}>Item Details</h2>
        <button
          type="button"
          onClick={() => setSelectedItem(null)}
          style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
          aria-label="Close"
        >
          <X size={22} />
        </button>
      </div>

      <div className="lnf-item-details-modal__body">
        <section className="lnf-item-details-section" aria-label="Item details">
          <h3 className="lnf-item-details-section__title">Item Details</h3>
          <dl className="lnf-item-details-grid">
            <div className="lnf-item-details-grid__field">
              <dt>Guest</dt>
              <dd>{selectedItem.guest_last_name || "Not recorded"}</dd>
            </div>
            <div className="lnf-item-details-grid__field">
              <dt>Location</dt>
              <dd>
                {formatLostFoundLocationDisplay(selectedItem.room_number) ||
                  selectedItem.room_number ||
                  "Not recorded"}
              </dd>
            </div>
            <div className="lnf-item-details-grid__field">
              <dt>Item</dt>
              <dd>{selectedItem.item_name || "Not recorded"}</dd>
            </div>
            <div className="lnf-item-details-grid__field">
              <dt>Date found</dt>
              <dd>
                {selectedItem.date_found || selectedItem.created_at
                  ? new Date(
                      selectedItem.date_found || selectedItem.created_at
                    ).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Not recorded"}
              </dd>
            </div>
            <div className="lnf-item-details-grid__field">
              <dt>Current status</dt>
              <dd>
                <span
                  className={`lnf-item-details-status ${statusPillClass(
                    selectedItem.status
                  )}`}
                >
                  {displayItemStatus(selectedItem.status)}
                </span>
              </dd>
            </div>
            <div className="lnf-item-details-grid__field">
              <dt>Found by</dt>
              <dd>{selectedItem.found_by || "Not recorded yet"}</dd>
            </div>
            <div className="lnf-item-details-grid__field">
              <dt>Created by</dt>
              <dd>
                {(() => {
                  const member = teamMembers.find(
                    (person: {
                      auth_user_id?: string;
                      username?: string;
                      first_name?: string;
                      last_name?: string;
                    }) =>
                      String(person.auth_user_id).trim() ===
                      String(selectedItem.created_by).trim()
                  );
                  return member
                    ? member.username ||
                        `${member.first_name || ""} ${member.last_name || ""}`.trim()
                    : "Not recorded yet";
                })()}
              </dd>
            </div>
          </dl>
        </section>

        <LostFoundShippingSection
          itemId={selectedItem.id}
          itemName={selectedItem.item_name}
          guestLastName={selectedItem.guest_last_name}
          itemStatus={selectedItem.status}
          itemLabelUrl={selectedItem.label_url || null}
          onItemMayHaveChanged={() => {
            void fetchItems();
          }}
        />

        <section className="lnf-item-details-section lnf-item-details-section--comments" aria-label="Comments">
          <h3 className="lnf-item-details-section__title">Comments</h3>
          <LostFoundCommentCell
            itemId={selectedItem.id}
            comments={selectedItem.comments}
            onSave={async (id, comments) => {
              await updateComments(id, comments);
              setSelectedItem((current: any | null) =>
                current && String(current.id) === String(id)
                  ? { ...current, comments }
                  : current
              );
            }}
          />
        </section>
      </div>

      <div className="lnf-item-details-modal__footer">
        <button
          type="button"
          onClick={() => setSelectedItem(null)}
          style={NEUTRAL_BUTTON}
          className="one-eyrie-btn one-eyrie-btn--neutral one-eyrie-btn--md"
          {...neutralHoverHandlers()}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}
        <LostFoundAddItemModal
          open={showAddModal}
          defaultFoundBy={currentUserName}
          onClose={() => setShowAddModal(false)}
          onSubmit={submitNewItem}
        />

        <SendShippingRequestModal
          open={Boolean(sendModalItem)}
          item={{
            id: Number(sendModalItem?.id),
            item_name: sendModalItem?.item_name,
            guest_last_name: sendModalItem?.guest_last_name,
          }}
          onClose={() => setSendModalItem(null)}
          onCreated={() => {
            setSendModalItem(null);
            setSuccessToast("Guest shipping email sent.");
            void fetchItems();
          }}
        />

        {commentEditItem ? (
          <div
            style={ONE_EYRIE_MODAL_OVERLAY}
            onClick={() => setCommentEditItem(null)}
          >
            <div
              className="lnf-comment-edit-modal"
              style={{
                ...ONE_EYRIE_MODAL_BOX,
                width: "460px",
                maxWidth: "calc(100vw - 24px)",
                minHeight: "280px",
                padding: 0,
              }}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setCommentEditItem(null);
                }
              }}
            >
              <div
                style={{
                  ...ONE_EYRIE_MODAL_HEADER,
                  marginBottom: 0,
                  padding: "16px 18px 12px",
                  borderBottom: `1px solid ${ONE_EYRIE.borderDivider}`,
                }}
              >
                <h2 style={{ margin: 0, color: gold, fontSize: "16px" }}>
                  {commentEditItem.comments?.trim()
                    ? "Edit Comment"
                    : "Add Comment"}
                </h2>
                <button
                  type="button"
                  onClick={() => setCommentEditItem(null)}
                  style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div style={{ padding: "16px 18px 18px" }}>
                <LostFoundCommentCell
                  variant="modal"
                  itemId={commentEditItem.id}
                  comments={commentEditItem.comments}
                  onSave={async (id, comments) => {
                    await updateComments(id, comments);
                    setCommentEditItem(null);
                    setSelectedItem((current: any | null) =>
                      current && String(current.id) === String(id)
                        ? { ...current, comments }
                        : current
                    );
                    setSuccessToast("Comment saved.");
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {actionError ? (
          <div
            role="alert"
            className="lnf-action-error-toast"
            style={{
              position: "fixed",
              bottom: "28px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              padding: "12px 18px",
              borderRadius: "10px",
              border: "1px solid #F87171",
              background: "#3F1D1D",
              color: "#FECACA",
              fontSize: "13px",
              fontWeight: 700,
              boxShadow: "0 10px 28px rgba(0, 0, 0, 0.45)",
              maxWidth: "min(520px, calc(100vw - 32px))",
            }}
          >
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ flex: 1 }}>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#FECACA",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 800,
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

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
  padding: "8px 20px 10px",
  fontSize: "12px",
  textTransform: "uppercase",
  verticalAlign: "middle",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 20px",
  verticalAlign: "middle",
  fontSize: "13px",
  textAlign: "left",
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

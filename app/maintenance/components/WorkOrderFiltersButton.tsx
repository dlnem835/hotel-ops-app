"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import {
  WorkOrderListFilters,
  WorkOrderPriorityFilter,
  WorkOrderSortOrder,
} from "../lib/work-order-list-filters";

const SORT_OPTIONS: { label: string; value: WorkOrderSortOrder }[] = [
  { label: "Oldest First", value: "oldest" },
  { label: "Newest First", value: "newest" },
];

const PRIORITY_OPTIONS: { label: string; value: WorkOrderPriorityFilter }[] = [
  { label: "All", value: "All" },
  { label: "Urgent", value: "Urgent" },
  { label: "Important", value: "Important" },
  { label: "Normal", value: "Normal" },
];

const filterMenuButton: CSSProperties = {
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

type WorkOrderFiltersButtonProps = {
  filters: WorkOrderListFilters;
  onFiltersChange: (filters: WorkOrderListFilters) => void;
};

export default function WorkOrderFiltersButton({
  filters,
  onFiltersChange,
}: WorkOrderFiltersButtonProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersDropdownRef = useRef<HTMLDivElement>(null);

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

  function updateFilters(partial: Partial<WorkOrderListFilters>) {
    onFiltersChange({ ...filters, ...partial });
  }

  return (
    <div
      ref={filtersDropdownRef}
      className="maintenance-wo-filters-dropdown lnf-filters-dropdown"
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
          <div
            className="lnf-filter-menu__heading"
            style={{
              color: "#E5E7EB",
              fontSize: "12px",
              fontWeight: "bold",
              marginBottom: "12px",
            }}
          >
            Sort
          </div>

          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateFilters({ sortOrder: option.value })}
              className="one-eyrie-menu-item"
              style={filterMenuButton}
            >
              {option.label}{" "}
              {filters.sortOrder === option.value ? (
                <Check size={14} style={{ marginLeft: "6px" }} />
              ) : null}
            </button>
          ))}

          <div
            className="lnf-filter-menu__divider"
            style={{ height: "1px", background: "#2A2A2A", margin: "14px 0" }}
          />

          <div
            className="lnf-filter-menu__heading"
            style={{
              color: "#E5E7EB",
              fontSize: "12px",
              fontWeight: "bold",
              marginBottom: "12px",
            }}
          >
            Priority
          </div>

          {PRIORITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateFilters({ priorityFilter: option.value })}
              className="one-eyrie-menu-item"
              style={filterMenuButton}
            >
              {option.label}{" "}
              {filters.priorityFilter === option.value ? (
                <Check size={14} style={{ marginLeft: "6px" }} />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

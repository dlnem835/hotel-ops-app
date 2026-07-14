"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { AdminPropertySummary } from "@/app/lib/platform-admin/types";

type AdminPropertyMultiSelectProps = {
  properties: AdminPropertySummary[];
  value: number[];
  onChange: (propertyIds: number[]) => void;
  disabled?: boolean;
};

export default function AdminPropertyMultiSelect({
  properties,
  value,
  onChange,
  disabled = false,
}: AdminPropertyMultiSelectProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => properties.filter((property) => value.includes(property.id)),
    [properties, value]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return properties;
    return properties.filter((property) =>
      property.name.toLowerCase().includes(needle)
    );
  }, [properties, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  function toggle(propertyId: number) {
    if (value.includes(propertyId)) {
      onChange(value.filter((id) => id !== propertyId));
    } else {
      onChange([...value, propertyId]);
    }
  }

  function selectAll() {
    onChange(properties.map((property) => property.id));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div
      className={
        open
          ? "admin-portal__property-multi admin-portal__property-multi--open"
          : "admin-portal__property-multi"
      }
      ref={containerRef}
    >
      <button
        type="button"
        className="admin-portal__property-multi-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
          setQuery("");
        }}
      >
        <span className="admin-portal__property-multi-summary">
          {selected.length === 0
            ? "Select properties"
            : `${selected.length} ${
                selected.length === 1 ? "property" : "properties"
              } selected`}
        </span>
        <ChevronDown size={16} aria-hidden className="admin-portal__timezone-chevron" />
      </button>

      {selected.length > 0 ? (
        <div className="admin-portal__property-chips">
          {selected.map((property) => (
            <button
              key={property.id}
              type="button"
              className="admin-portal__property-chip"
              disabled={disabled}
              onClick={() => toggle(property.id)}
            >
              <span>{property.name}</span>
              <X size={12} aria-hidden />
              <span className="sr-only">Remove {property.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="admin-portal__property-multi-panel" role="presentation">
          <div className="admin-portal__timezone-search-wrap">
            <input
              ref={searchRef}
              type="text"
              value={query}
              spellCheck={false}
              autoComplete="off"
              placeholder="Search properties…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                  setQuery("");
                }
              }}
            />
          </div>
          <div className="admin-portal__property-multi-toolbar">
            <button type="button" className="admin-portal__link-button" onClick={selectAll}>
              Select all
            </button>
            <button type="button" className="admin-portal__link-button" onClick={clearAll}>
              Clear all
            </button>
          </div>
          <ul id={listId} className="admin-portal__timezone-options" role="listbox">
            {filtered.map((property) => {
              const checked = value.includes(property.id);
              return (
                <li key={property.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked}
                    className={
                      checked
                        ? "admin-portal__timezone-option admin-portal__timezone-option--selected"
                        : "admin-portal__timezone-option"
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggle(property.id)}
                  >
                    <span className="admin-portal__timezone-option-label">
                      {checked ? "✓ " : ""}
                      {property.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  filterSupportedTimezones,
  findSupportedTimezone,
  type SupportedTimezone,
} from "@/app/lib/timezones";

type AdminTimezoneSelectProps = {
  value: string;
  onChange: (ianaTimezoneId: string) => void;
  disabled?: boolean;
};

/**
 * Modern searchable select for property timezones.
 * Closed state looks like a dropdown (chevron + friendly label). Opening
 * reveals an in-panel search field. Always emits/stores the IANA id.
 */
export default function AdminTimezoneSelect({
  value,
  onChange,
  disabled = false,
}: AdminTimezoneSelectProps) {
  const listId = useId();
  const searchId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const selected = findSupportedTimezone(value);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => filterSupportedTimezones(open ? query : ""),
    [open, query]
  );

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

  function openPanel() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    setQuery("");
  }

  function selectZone(zone: SupportedTimezone) {
    onChange(zone.id);
    closePanel();
  }

  return (
    <div
      className={
        open
          ? "admin-portal__timezone-select admin-portal__timezone-select--open"
          : "admin-portal__timezone-select"
      }
      ref={containerRef}
    >
      <button
        type="button"
        className="admin-portal__timezone-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (open) closePanel();
          else openPanel();
        }}
      >
        <span className="admin-portal__timezone-trigger-text">
          {selected ? (
            <>
              <span className="admin-portal__timezone-trigger-label">
                {selected.label}
              </span>
              <span className="admin-portal__timezone-trigger-id">{selected.id}</span>
            </>
          ) : (
            <span className="admin-portal__timezone-trigger-placeholder">
              Select a timezone
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className="admin-portal__timezone-chevron"
          aria-hidden
        />
      </button>

      {open ? (
        <div className="admin-portal__timezone-panel" role="presentation">
          <div className="admin-portal__timezone-search-wrap">
            <input
              id={searchId}
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={query}
              placeholder="Search timezones…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closePanel();
                }
                if (event.key === "Enter" && filtered.length > 0) {
                  event.preventDefault();
                  selectZone(filtered[0]);
                }
              }}
            />
          </div>

          <ul id={listId} className="admin-portal__timezone-options" role="listbox">
            {filtered.map((zone) => {
              const selectedOption = zone.id === value;
              return (
                <li key={zone.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedOption}
                    className={
                      selectedOption
                        ? "admin-portal__timezone-option admin-portal__timezone-option--selected"
                        : "admin-portal__timezone-option"
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectZone(zone)}
                  >
                    <span className="admin-portal__timezone-option-label">
                      {zone.label}
                    </span>
                    <span className="admin-portal__timezone-option-id">{zone.id}</span>
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

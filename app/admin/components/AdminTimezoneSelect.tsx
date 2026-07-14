"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  filterSupportedTimezones,
  findSupportedTimezone,
  formatTimezoneOptionLabel,
  type SupportedTimezone,
} from "@/app/lib/timezones";

type AdminTimezoneSelectProps = {
  value: string;
  onChange: (ianaTimezoneId: string) => void;
  disabled?: boolean;
};

/**
 * Searchable property-timezone control. Displays friendly labels but always
 * emits/stores the IANA identifier (e.g. America/New_York).
 */
export default function AdminTimezoneSelect({
  value,
  onChange,
  disabled = false,
}: AdminTimezoneSelectProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = findSupportedTimezone(value);
  const [query, setQuery] = useState(
    selected ? formatTimezoneOptionLabel(selected) : value
  );
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => filterSupportedTimezones(query), [query]);

  useEffect(() => {
    const next = findSupportedTimezone(value);
    if (next) {
      setQuery(formatTimezoneOptionLabel(next));
    }
  }, [value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        const current = findSupportedTimezone(value);
        if (current) {
          setQuery(formatTimezoneOptionLabel(current));
        }
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [value]);

  function selectZone(zone: SupportedTimezone) {
    onChange(zone.id);
    setQuery(formatTimezoneOptionLabel(zone));
    setOpen(false);
  }

  return (
    <div className="admin-portal__timezone-select" ref={containerRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={query}
        placeholder="Search timezones…"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            const current = findSupportedTimezone(value);
            if (current) setQuery(formatTimezoneOptionLabel(current));
          }
          if (event.key === "Enter" && filtered.length === 1) {
            event.preventDefault();
            selectZone(filtered[0]);
          }
        }}
      />
      {open ? (
        <ul id={listId} className="admin-portal__timezone-options" role="listbox">
          {filtered.length === 0 ? (
            <li className="admin-portal__timezone-empty">No matching timezones</li>
          ) : (
            filtered.map((zone) => {
              const selectedOption = zone.id === value;
              return (
                <li key={zone.id} role="option" aria-selected={selectedOption}>
                  <button
                    type="button"
                    className={
                      selectedOption
                        ? "admin-portal__timezone-option admin-portal__timezone-option--selected"
                        : "admin-portal__timezone-option"
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectZone(zone)}
                  >
                    {formatTimezoneOptionLabel(zone)}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
      <p className="admin-portal__field-hint">
        Stored as IANA timezone id
        {selected ? `: ${selected.id}` : " (select a supported timezone)"}
      </p>
    </div>
  );
}

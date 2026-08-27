"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  filterWorkOrderLocationOptions,
  WorkOrderLocationOption,
} from "../lib/work-order-location";

type WorkOrderLocationFieldProps = {
  options: WorkOrderLocationOption[];
  loading?: boolean;
  selectedId: number | null;
  selectedLabel: string;
  onSelect: (id: number, label: string) => void;
  onClearSelection: () => void;
  disabled?: boolean;
};

export default function WorkOrderLocationField({
  options,
  loading = false,
  selectedId,
  selectedLabel,
  onSelect,
  onClearSelection,
  disabled = false,
}: WorkOrderLocationFieldProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(
    () => filterWorkOrderLocationOptions(options, query),
    [options, query]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [selectedId, selectedLabel, open]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  function handleFocus() {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
    }
    setOpen(true);
    // Start with an empty filter so guest rooms (listed first) are visible
    // instead of narrowing to the current label.
    setQuery("");
  }

  function handleBlur() {
    blurTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 150);
  }

  function handleInputChange(value: string) {
    setQuery(value);
    if (selectedId !== null) {
      onClearSelection();
    }
    setOpen(true);
  }

  function handleOptionSelect(option: WorkOrderLocationOption) {
    onSelect(option.id, option.label);
    setQuery("");
    setOpen(false);
  }

  const inputValue = open ? query : selectedLabel;
  const showList = open && !loading && filteredOptions.length > 0;

  return (
    <div
      ref={containerRef}
      className="work-order-location-field"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          handleBlur();
        }
      }}
    >
      <input
        id={listId}
        className="work-order-modal__input work-order-location-field__input"
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${listId}-listbox`}
        aria-autocomplete="list"
        value={inputValue}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={handleFocus}
        placeholder={loading ? "Loading locations…" : "Search room or area…"}
        disabled={disabled || loading}
        autoComplete="off"
      />
      {showList ? (
        <ul
          id={`${listId}-listbox`}
          className="work-order-location-field__list"
          role="listbox"
        >
          {filteredOptions.map((option) => (
            <li key={option.id} role="presentation">
              <button
                type="button"
                role="option"
                className="work-order-location-field__option"
                aria-selected={selectedId === option.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleOptionSelect(option)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

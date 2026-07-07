"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  filterWorkOrderLocationOptions,
  type WorkOrderLocationOption,
} from "@/app/maintenance/lib/work-order-location";

const ALL_AREA_OPTION: WorkOrderLocationOption = {
  id: -1,
  label: "All",
  searchText: "all",
};

type ReportsWorkOrderAreaFieldProps = {
  options: WorkOrderLocationOption[];
  selectedId: number | null;
  selectedLabel: string;
  onSelectAll: () => void;
  onSelect: (id: number, label: string) => void;
  onClearSelection: () => void;
};

export default function ReportsWorkOrderAreaField({
  options,
  selectedId,
  selectedLabel,
  onSelectAll,
  onSelect,
  onClearSelection,
}: ReportsWorkOrderAreaFieldProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const listOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const filtered = filterWorkOrderLocationOptions(options, query);
    const showAll = !trimmed || ALL_AREA_OPTION.searchText.includes(trimmed);
    return showAll ? [ALL_AREA_OPTION, ...filtered] : filtered;
  }, [options, query]);

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
    setQuery(selectedLabel);
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
    if (option.id === ALL_AREA_OPTION.id) {
      onSelectAll();
    } else {
      onSelect(option.id, option.label);
    }
    setQuery("");
    setOpen(false);
  }

  const inputValue = open ? query : selectedLabel;
  const showList = open && listOptions.length > 0;

  return (
    <div
      ref={containerRef}
      className="reports-wo-area-field"
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          handleBlur();
        }
      }}
    >
      <input
        id={listId}
        className="one-eyrie-field reports-wo-area-field__input"
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${listId}-listbox`}
        aria-autocomplete="list"
        value={inputValue}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={handleFocus}
        placeholder="Search room or area…"
        autoComplete="off"
      />
      {showList ? (
        <ul
          id={`${listId}-listbox`}
          className="reports-wo-area-field__list"
          role="listbox"
        >
          {listOptions.map((option) => (
            <li key={option.id} role="presentation">
              <button
                type="button"
                role="option"
                className="reports-wo-area-field__option"
                aria-selected={
                  option.id === ALL_AREA_OPTION.id
                    ? selectedId === null && selectedLabel === "All"
                    : selectedId === option.id
                }
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

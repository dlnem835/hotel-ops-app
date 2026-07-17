"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Building2, Check, ChevronDown, Search } from "lucide-react";
import { usePropertyContext } from "@/app/components/TenantContextProviders";
import { getPropertyDisplayLabels } from "@/app/lib/tenant/property-display";
import type { TenantPropertySummary } from "@/app/lib/tenant/types";

const SEARCH_THRESHOLD = 8;
const MAX_VISIBLE_OPTIONS = 8;

type OneEyriePropertySelectorProps = {
  /** Sidebar (default) or mobile field-ops menu placement. */
  variant?: "sidebar" | "mobile";
};

function propertySearchHaystack(property: TenantPropertySummary): string {
  return [property.name, property.brand ?? ""]
    .join(" ")
    .trim()
    .toLowerCase();
}

/** Compact closed-card labels: exactly two single-line rows with ellipsis. */
function PropertyClosedLabel({
  name,
  brand,
}: {
  name: string;
  brand?: string | null;
}) {
  const labels = getPropertyDisplayLabels({ name, brand });
  return (
    <span className="one-eyrie-property-selector__name">
      <span className="one-eyrie-property-selector__name-primary">
        {labels.primary}
      </span>
      {labels.secondary ? (
        <span className="one-eyrie-property-selector__name-secondary">
          {labels.secondary}
        </span>
      ) : null}
    </span>
  );
}

/** Full official name for open dropdown rows (may wrap). */
function PropertyFullName({ name }: { name: string }) {
  return <span className="one-eyrie-property-selector__option-name">{name}</span>;
}

export default function OneEyriePropertySelector({
  variant = "sidebar",
}: OneEyriePropertySelectorProps) {
  const {
    properties,
    activeProperty,
    loading,
    switching,
    setActivePropertyId,
  } = usePropertyContext();
  const listId = useId();
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const showSelect = properties.length > 1;
  const searchable = properties.length > SEARCH_THRESHOLD;
  const controlsLocked = switching;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((property) =>
      propertySearchHaystack(property).includes(q)
    );
  }, [properties, query]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      if (searchable) {
        searchRef.current?.focus();
      } else {
        listRef.current?.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    if (filtered.length === 0) {
      setActiveIndex(0);
      return;
    }
    setActiveIndex((index) => Math.min(index, filtered.length - 1));
  }, [filtered.length, open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    if (controlsLocked && open) {
      setOpen(false);
      setQuery("");
    }
  }, [controlsLocked, open]);

  if (loading) {
    return (
      <div
        className={`one-eyrie-property-selector one-eyrie-property-selector--loading one-eyrie-property-selector--${variant}`}
      >
        <div className="one-eyrie-property-selector__card one-eyrie-property-selector__card--static">
          <Building2
            className="one-eyrie-property-selector__icon"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="one-eyrie-property-selector__name">Loading…</span>
        </div>
      </div>
    );
  }

  if (!activeProperty) {
    return null;
  }

  function closePanel() {
    setOpen(false);
    setQuery("");
  }

  function openPanel() {
    if (controlsLocked) return;
    setQuery("");
    const selectedIdx = properties.findIndex(
      (property) => property.id === activeProperty?.id
    );
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
    setOpen(true);
  }

  async function selectProperty(propertyId: number) {
    closePanel();
    if (propertyId === activeProperty?.id || controlsLocked) return;
    await setActivePropertyId(propertyId);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (controlsLocked) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) openPanel();
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      closePanel();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
      return;
    }

    if (filtered.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filtered.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(filtered.length - 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const target = filtered[activeIndex];
      if (target) void selectProperty(target.id);
    }
  }

  const rootClass = [
    "one-eyrie-property-selector",
    `one-eyrie-property-selector--${variant}`,
    open ? "one-eyrie-property-selector--open" : "",
    controlsLocked ? "one-eyrie-property-selector--switching" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!showSelect) {
    return (
      <div className={rootClass}>
        <div
          className="one-eyrie-property-selector__card one-eyrie-property-selector__card--static"
          title={activeProperty.name}
          aria-label={`Current property: ${activeProperty.name}`}
        >
          <Building2
            className="one-eyrie-property-selector__icon"
            strokeWidth={1.75}
            aria-hidden
          />
          <PropertyClosedLabel
            name={activeProperty.name}
            brand={activeProperty.brand}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        className="one-eyrie-property-selector__card one-eyrie-property-selector__trigger"
        title={activeProperty.name}
        aria-label={`Select property. Current property: ${activeProperty.name}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={controlsLocked}
        onClick={() => {
          if (controlsLocked) return;
          if (open) closePanel();
          else openPanel();
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <Building2
          className="one-eyrie-property-selector__icon"
          strokeWidth={1.75}
          aria-hidden
        />
        <PropertyClosedLabel
          name={activeProperty.name}
          brand={activeProperty.brand}
        />
        <ChevronDown
          className={
            open
              ? "one-eyrie-property-selector__chevron one-eyrie-property-selector__chevron--open"
              : "one-eyrie-property-selector__chevron"
          }
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className="one-eyrie-property-selector__panel"
          role="presentation"
          onKeyDown={onListKeyDown}
        >
          {searchable ? (
            <div className="one-eyrie-property-selector__search-wrap">
              <Search
                className="one-eyrie-property-selector__search-icon"
                strokeWidth={1.75}
                aria-hidden
              />
              <input
                id={searchId}
                ref={searchRef}
                type="search"
                className="one-eyrie-property-selector__search"
                role="combobox"
                aria-label="Search properties"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  filtered[activeIndex]
                    ? `${listId}-option-${filtered[activeIndex].id}`
                    : undefined
                }
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Search by name or location…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onListKeyDown}
              />
            </div>
          ) : null}

          <ul
            id={listId}
            ref={listRef}
            className="one-eyrie-property-selector__options"
            role="listbox"
            aria-label="Select property"
            tabIndex={searchable ? -1 : 0}
            style={{
              maxHeight: `calc(${MAX_VISIBLE_OPTIONS} * 3.15rem + 0.5rem)`,
            }}
          >
            {filtered.length === 0 ? (
              <li className="one-eyrie-property-selector__empty" role="presentation">
                No matching properties
              </li>
            ) : (
              filtered.map((property, index) => {
                const selected = property.id === activeProperty.id;
                const active = index === activeIndex;
                return (
                  <li key={property.id} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-option-${property.id}`}
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      role="option"
                      aria-selected={selected}
                      title={property.name}
                      className={[
                        "one-eyrie-property-selector__option",
                        selected
                          ? "one-eyrie-property-selector__option--selected"
                          : "",
                        active
                          ? "one-eyrie-property-selector__option--active"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void selectProperty(property.id)}
                    >
                      <Building2
                        className="one-eyrie-property-selector__option-icon"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <PropertyFullName name={property.name} />
                      {selected ? (
                        <Check
                          className="one-eyrie-property-selector__check"
                          strokeWidth={2.25}
                          aria-hidden
                        />
                      ) : (
                        <span
                          className="one-eyrie-property-selector__check-spacer"
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

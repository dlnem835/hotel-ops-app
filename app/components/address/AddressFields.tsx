"use client";

import type { CSSProperties } from "react";
import {
  ADDRESS_COUNTRY_OPTIONS,
  type AddressValue,
} from "@/app/lib/address/format";
import "./address-fields.css";

export type AddressFieldsVariant = "guest" | "settings" | "admin";

export type AddressFieldsProps = {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  variant?: AddressFieldsVariant;
  /** Prefix for input ids (accessibility). */
  idPrefix?: string;
  disabled?: boolean;
  required?: boolean;
  /** Optional inline input style for Settings panels that already pass theme styles. */
  inputStyle?: CSSProperties;
  className?: string;
};

/**
 * Canonical One Eyrie address field layout:
 * Street *, Apartment/Suite (optional), City *, State *, ZIP *, Country.
 */
export default function AddressFields({
  value,
  onChange,
  variant = "settings",
  idPrefix = "address",
  disabled = false,
  required = true,
  inputStyle,
  className = "",
}: AddressFieldsProps) {
  function patch(partial: Partial<AddressValue>) {
    onChange({ ...value, ...partial });
  }

  const rootClass = [
    "oe-address-fields",
    `oe-address-fields--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <label className="oe-address-fields__field oe-address-fields__field--full">
        <span>
          Street Address{required ? " *" : ""}
        </span>
        <input
          id={`${idPrefix}-line1`}
          type="text"
          required={required}
          disabled={disabled}
          autoComplete="address-line1"
          value={value.line1}
          onChange={(event) => patch({ line1: event.target.value })}
          style={inputStyle}
        />
      </label>

      <label className="oe-address-fields__field oe-address-fields__field--full">
        <span>Apartment / Suite (optional)</span>
        <input
          id={`${idPrefix}-line2`}
          type="text"
          disabled={disabled}
          autoComplete="address-line2"
          value={value.line2}
          onChange={(event) => patch({ line2: event.target.value })}
          style={inputStyle}
        />
      </label>

      <div className="oe-address-fields__row">
        <label className="oe-address-fields__field">
          <span>City{required ? " *" : ""}</span>
          <input
            id={`${idPrefix}-city`}
            type="text"
            required={required}
            disabled={disabled}
            autoComplete="address-level2"
            value={value.city}
            onChange={(event) => patch({ city: event.target.value })}
            style={inputStyle}
          />
        </label>

        <label className="oe-address-fields__field oe-address-fields__field--state">
          <span>State{required ? " *" : ""}</span>
          <input
            id={`${idPrefix}-state`}
            type="text"
            required={required}
            disabled={disabled}
            autoComplete="address-level1"
            value={value.state}
            onChange={(event) => patch({ state: event.target.value })}
            style={inputStyle}
          />
        </label>
      </div>

      <div className="oe-address-fields__row">
        <label className="oe-address-fields__field">
          <span>ZIP Code{required ? " *" : ""}</span>
          <input
            id={`${idPrefix}-postal`}
            type="text"
            required={required}
            disabled={disabled}
            autoComplete="postal-code"
            value={value.postal}
            onChange={(event) => patch({ postal: event.target.value })}
            style={inputStyle}
          />
        </label>

        <label className="oe-address-fields__field">
          <span>Country</span>
          <select
            id={`${idPrefix}-country`}
            disabled={disabled}
            autoComplete="country"
            value={value.country || "US"}
            onChange={(event) => patch({ country: event.target.value })}
            style={inputStyle}
          >
            {ADDRESS_COUNTRY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

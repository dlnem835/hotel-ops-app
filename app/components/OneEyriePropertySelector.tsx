"use client";

import { Building2, ChevronDown } from "lucide-react";
import { usePropertyContext } from "@/app/components/TenantContextProviders";

export default function OneEyriePropertySelector() {
  const { properties, activeProperty, loading, setActivePropertyId } = usePropertyContext();

  if (loading) {
    return (
      <div className="one-eyrie-property-selector one-eyrie-property-selector--loading">
        <span className="one-eyrie-property-selector__label">Property</span>
        <span className="one-eyrie-property-selector__value">Loading…</span>
      </div>
    );
  }

  if (!activeProperty) {
    return null;
  }

  const showSelect = properties.length > 1;

  return (
    <div className="one-eyrie-property-selector">
      <span className="one-eyrie-property-selector__label">Property</span>
      {showSelect ? (
        <div className="one-eyrie-property-selector__control-wrap">
          <Building2
            className="one-eyrie-property-selector__icon"
            strokeWidth={1.75}
            aria-hidden
          />
          <select
            className="one-eyrie-property-selector__select"
            value={activeProperty.id}
            onChange={(event) => {
              const nextId = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(nextId)) {
                void setActivePropertyId(nextId);
              }
            }}
            aria-label="Active property"
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <ChevronDown className="one-eyrie-property-selector__chevron" aria-hidden />
        </div>
      ) : (
        <div className="one-eyrie-property-selector__single">
          <Building2
            className="one-eyrie-property-selector__icon"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="one-eyrie-property-selector__value">{activeProperty.name}</span>
        </div>
      )}
    </div>
  );
}

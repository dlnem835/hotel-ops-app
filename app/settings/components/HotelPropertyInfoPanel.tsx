"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import AddressFields from "@/app/components/address/AddressFields";
import {
  propertyFieldsToAddressValue,
  type PropertyAddressFields,
} from "@/app/lib/address/property-address";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { HotelProperty } from "../lib/hotel-property-types";
import {
  goldHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "../lib/settings-ui-interactions";

type HotelPropertyInfoPanelProps = {
  inputStyle: React.CSSProperties;
  variant?: "default" | "header";
};

const compactInput = (inputStyle: React.CSSProperties): React.CSSProperties => ({
  ...inputStyle,
  height: "30px",
  minHeight: "30px",
  padding: "0 10px",
  fontSize: "12px",
});

const emptyProperty: HotelProperty = {
  hotelName: "",
  address: "",
  addressLine1: "",
  addressLine2: "",
  addressCity: "",
  addressState: "",
  addressPostal: "",
  addressCountry: "US",
  phoneNumber: "",
  updatedAt: null,
  addressComplete: false,
  addressIncompleteFields: [
    "Street Address",
    "City",
    "State / Province",
    "Postal Code",
    "Country",
  ],
};

function toAddressFields(property: HotelProperty): PropertyAddressFields {
  return {
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2,
    addressCity: property.addressCity,
    addressState: property.addressState,
    addressPostal: property.addressPostal,
    addressCountry: property.addressCountry || "US",
  };
}

export default function HotelPropertyInfoPanel({
  inputStyle,
  variant = "default",
}: HotelPropertyInfoPanelProps) {
  const [property, setProperty] = useState<HotelProperty>(emptyProperty);
  const [draft, setDraft] = useState<HotelProperty>(emptyProperty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;

    void tenantFetch("/api/hotel-property")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Unable to load hotel information");
        }
        return result.property as HotelProperty;
      })
      .then((loaded) => {
        if (!mounted) return;
        setProperty(loaded);
        setDraft(loaded);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load hotel information"
        );
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const isDirty =
    draft.hotelName !== property.hotelName ||
    draft.addressLine1 !== property.addressLine1 ||
    draft.addressLine2 !== property.addressLine2 ||
    draft.addressCity !== property.addressCity ||
    draft.addressState !== property.addressState ||
    draft.addressPostal !== property.addressPostal ||
    draft.addressCountry !== property.addressCountry ||
    draft.phoneNumber !== property.phoneNumber;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await tenantFetch("/api/hotel-property", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelName: draft.hotelName,
          addressLine1: draft.addressLine1,
          addressLine2: draft.addressLine2,
          addressCity: draft.addressCity,
          addressState: draft.addressState,
          addressPostal: draft.addressPostal,
          addressCountry: draft.addressCountry,
          phoneNumber: draft.phoneNumber,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save hotel information");
      }

      const updated = result.property as HotelProperty;
      setProperty(updated);
      setDraft(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save hotel information"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className={`one-eyrie-hotel-property-panel${variant === "header" ? " one-eyrie-hotel-property-panel--header" : ""}`}
      aria-label="Hotel building information"
    >
      <div className="one-eyrie-hotel-property-panel__header">
        <div className="one-eyrie-hotel-property-panel__title-row">
          <Building2 size={14} color={ONE_EYRIE.gold} aria-hidden />
          <span className="one-eyrie-hotel-property-panel__title">
            Hotel Building Information
          </span>
        </div>

        {!loading ? (
          <div className="one-eyrie-hotel-property-panel__actions">
            {error ? (
              <div className="one-eyrie-hotel-property-panel__error">{error}</div>
            ) : null}
            {saved ? (
              <div className="one-eyrie-hotel-property-panel__saved">Saved.</div>
            ) : null}
            <button
              type="button"
              className="one-eyrie-hotel-property-panel__save"
              disabled={saving || !isDirty}
              onClick={() => void handleSave()}
              style={{
                ...SETTINGS_BUTTON_BASE,
                border: `1px solid ${ONE_EYRIE.gold}`,
                background: isDirty ? ONE_EYRIE.gold : "transparent",
                color: isDirty ? ONE_EYRIE.surface : ONE_EYRIE.gold,
                borderRadius: "8px",
                height: "30px",
                padding: "0 12px",
                fontWeight: 800,
                fontSize: "12px",
                opacity: saving || !isDirty ? 0.55 : 1,
                cursor: saving || !isDirty ? "not-allowed" : "pointer",
              }}
              {...(isDirty && !saving ? goldHoverHandlers("primary") : goldHoverHandlers("secondary", saving || !isDirty))}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="one-eyrie-hotel-property-panel__status">Loading…</div>
      ) : (
        <>
          {!draft.addressComplete ? (
            <div
              style={{
                marginBottom: "10px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: `1px solid ${ONE_EYRIE.border}`,
                background: ONE_EYRIE.surfaceInset,
                color: "#FECACA",
                fontSize: "12px",
                lineHeight: 1.45,
              }}
            >
              Complete the property address fields below. This address is the
              canonical Ship From location for Lost &amp; Found automated
              shipping
              {draft.addressIncompleteFields.length > 0
                ? `: missing ${draft.addressIncompleteFields.join(", ")}.`
                : "."}
            </div>
          ) : null}

          <div className="one-eyrie-hotel-property-panel__fields">
            <label className="one-eyrie-hotel-property-panel__field">
              <span>Hotel name</span>
              <input
                type="text"
                value={draft.hotelName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    hotelName: event.target.value,
                  }))
                }
                placeholder="Property name"
                style={compactInput(inputStyle)}
              />
            </label>

            <div
              className="one-eyrie-hotel-property-panel__field one-eyrie-hotel-property-panel__field--address"
              style={{ gridColumn: "1 / -1" }}
            >
              <span
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: ONE_EYRIE.textSubtle,
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Property address (Ship From)
              </span>
              <AddressFields
                variant="settings"
                idPrefix="hotel-property"
                required
                inputStyle={compactInput(inputStyle)}
                value={propertyFieldsToAddressValue(toAddressFields(draft))}
                onChange={(next) =>
                  setDraft((current) => ({
                    ...current,
                    addressLine1: next.line1,
                    addressLine2: next.line2,
                    addressCity: next.city,
                    addressState: next.state,
                    addressPostal: next.postal,
                    addressCountry: next.country,
                  }))
                }
              />
            </div>

            <label className="one-eyrie-hotel-property-panel__field">
              <span>Phone</span>
              <input
                type="tel"
                value={draft.phoneNumber}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    phoneNumber: event.target.value,
                  }))
                }
                placeholder="Main hotel line"
                style={compactInput(inputStyle)}
              />
            </label>
          </div>
        </>
      )}
    </section>
  );
}

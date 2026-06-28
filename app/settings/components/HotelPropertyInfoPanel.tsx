"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
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
  phoneNumber: "",
  updatedAt: null,
};

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

    void fetch("/api/hotel-property")
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
    draft.address !== property.address ||
    draft.phoneNumber !== property.phoneNumber;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/hotel-property", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelName: draft.hotelName,
          address: draft.address,
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
        <div className="one-eyrie-hotel-property-panel__fields">
          <label className="one-eyrie-hotel-property-panel__field">
            <span>Hotel name</span>
            <input
              type="text"
              value={draft.hotelName}
              onChange={(event) =>
                setDraft((current) => ({ ...current, hotelName: event.target.value }))
              }
              placeholder="Property name"
              style={compactInput(inputStyle)}
            />
          </label>

          <label className="one-eyrie-hotel-property-panel__field one-eyrie-hotel-property-panel__field--address">
            <span>Address</span>
            <input
              type="text"
              value={draft.address}
              onChange={(event) =>
                setDraft((current) => ({ ...current, address: event.target.value }))
              }
              placeholder="Street, city, state, ZIP"
              style={compactInput(inputStyle)}
            />
          </label>

          <label className="one-eyrie-hotel-property-panel__field">
            <span>Phone</span>
            <input
              type="tel"
              value={draft.phoneNumber}
              onChange={(event) =>
                setDraft((current) => ({ ...current, phoneNumber: event.target.value }))
              }
              placeholder="Main hotel line"
              style={compactInput(inputStyle)}
            />
          </label>
        </div>
      )}
    </section>
  );
}

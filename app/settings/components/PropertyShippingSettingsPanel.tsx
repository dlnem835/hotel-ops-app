"use client";

import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import AddressFields from "@/app/components/address/AddressFields";
import type { AddressValue } from "@/app/lib/address/format";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  getPackagePreset,
  PACKAGE_PRESETS,
  type PackagePresetKey,
} from "@/app/lib/shipping/package-presets";
import {
  getShippingSettingsIncompleteFields,
  type PropertyShippingSettings,
} from "@/app/lib/lost-found-shipping/property-shipping-settings";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import {
  goldHoverHandlers,
  SETTINGS_BUTTON_BASE,
} from "../lib/settings-ui-interactions";

type PropertyShippingSettingsPanelProps = {
  inputStyle: React.CSSProperties;
};

const compactInput = (inputStyle: React.CSSProperties): React.CSSProperties => ({
  ...inputStyle,
  height: "30px",
  minHeight: "30px",
  padding: "0 10px",
  fontSize: "12px",
});

const emptyDraft: PropertyShippingSettings = {
  propertyId: 0,
  organizationId: 0,
  shippingEnabled: false,
  senderName: "",
  shipFromLine1: "",
  shipFromLine2: "",
  shipFromCity: "",
  shipFromState: "",
  shipFromPostal: "",
  shipFromCountry: "US",
  propertyPhone: "",
  propertyEmail: "",
  defaultPackagePreset: "small_box",
  defaultLengthIn: 8,
  defaultWidthIn: 6,
  defaultHeightIn: 4,
  defaultWeightOz: 16,
  defaultSenderContact: "",
  tokenTtlHours: 168,
  updatedAt: null,
  propertyAddressComplete: false,
  propertyAddressIncompleteFields: [],
};

const futureFieldStyle: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
};

function draftsEqual(a: PropertyShippingSettings, b: PropertyShippingSettings): boolean {
  return (
    a.shippingEnabled === b.shippingEnabled &&
    a.senderName === b.senderName &&
    a.shipFromLine1 === b.shipFromLine1 &&
    a.shipFromLine2 === b.shipFromLine2 &&
    a.shipFromCity === b.shipFromCity &&
    a.shipFromState === b.shipFromState &&
    a.shipFromPostal === b.shipFromPostal &&
    a.shipFromCountry === b.shipFromCountry &&
    a.propertyPhone === b.propertyPhone &&
    a.propertyEmail === b.propertyEmail &&
    a.defaultPackagePreset === b.defaultPackagePreset &&
    a.defaultLengthIn === b.defaultLengthIn &&
    a.defaultWidthIn === b.defaultWidthIn &&
    a.defaultHeightIn === b.defaultHeightIn &&
    a.defaultWeightOz === b.defaultWeightOz &&
    a.defaultSenderContact === b.defaultSenderContact &&
    a.tokenTtlHours === b.tokenTtlHours
  );
}

function draftToAddress(draft: PropertyShippingSettings): AddressValue {
  return {
    line1: draft.shipFromLine1,
    line2: draft.shipFromLine2,
    city: draft.shipFromCity,
    state: draft.shipFromState,
    postal: draft.shipFromPostal,
    country: draft.shipFromCountry || "US",
  };
}

export default function PropertyShippingSettingsPanel({
  inputStyle,
}: PropertyShippingSettingsPanelProps) {
  const [saved, setSaved] = useState<PropertyShippingSettings>(emptyDraft);
  const [draft, setDraft] = useState<PropertyShippingSettings>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let mounted = true;

    void tenantFetch("/api/property-shipping-settings")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Unable to load shipping settings");
        }
        return result.settings as PropertyShippingSettings;
      })
      .then((loaded) => {
        if (!mounted) return;
        setSaved(loaded);
        setDraft(loaded);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load shipping settings"
        );
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const incompleteFields = useMemo(
    () => getShippingSettingsIncompleteFields(draft),
    [draft]
  );
  const isDirty = !draftsEqual(draft, saved);

  function applyPreset(key: PackagePresetKey) {
    const preset = getPackagePreset(key);
    setDraft((current) => ({
      ...current,
      defaultPackagePreset: key,
      defaultLengthIn: preset.lengthIn,
      defaultWidthIn: preset.widthIn,
      defaultHeightIn: preset.heightIn,
      defaultWeightOz: preset.weightOz,
    }));
  }

  function setAddress(next: AddressValue) {
    setDraft((current) => ({
      ...current,
      shipFromLine1: next.line1,
      shipFromLine2: next.line2,
      shipFromCity: next.city,
      shipFromState: next.state,
      shipFromPostal: next.postal,
      shipFromCountry: next.country || "US",
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setJustSaved(false);

    try {
      const response = await tenantFetch("/api/property-shipping-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingEnabled: draft.shippingEnabled,
          senderName: draft.senderName,
          shipFromLine1: draft.shipFromLine1,
          shipFromLine2: draft.shipFromLine2,
          shipFromCity: draft.shipFromCity,
          shipFromState: draft.shipFromState,
          shipFromPostal: draft.shipFromPostal,
          shipFromCountry: draft.shipFromCountry,
          propertyPhone: draft.propertyPhone,
          propertyEmail: draft.propertyEmail,
          defaultPackagePreset: draft.defaultPackagePreset,
          defaultLengthIn: draft.defaultLengthIn,
          defaultWidthIn: draft.defaultWidthIn,
          defaultHeightIn: draft.defaultHeightIn,
          defaultWeightOz: draft.defaultWeightOz,
          defaultSenderContact: draft.defaultSenderContact,
          tokenTtlHours: draft.tokenTtlHours,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save shipping settings");
      }

      const updated = result.settings as PropertyShippingSettings;
      setSaved(updated);
      setDraft(updated);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save shipping settings"
      );
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle = compactInput(inputStyle);

  return (
    <section
      className="one-eyrie-hotel-property-panel"
      aria-label="Shipping settings"
      style={{ maxWidth: "920px" }}
    >
      <div className="one-eyrie-hotel-property-panel__header">
        <div className="one-eyrie-hotel-property-panel__title-row">
          <Package size={14} color={ONE_EYRIE.gold} aria-hidden />
          <span className="one-eyrie-hotel-property-panel__title">
            Shipping Settings
          </span>
        </div>

        {!loading ? (
          <div className="one-eyrie-hotel-property-panel__actions">
            {error ? (
              <div className="one-eyrie-hotel-property-panel__error">{error}</div>
            ) : null}
            {justSaved ? (
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
              {...(isDirty && !saving
                ? goldHoverHandlers("primary")
                : goldHoverHandlers("secondary", saving || !isDirty))}
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
          {incompleteFields.length > 0 ? (
            <div
              style={{
                marginBottom: "10px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: `1px solid ${ONE_EYRIE.border}`,
                background: ONE_EYRIE.surfaceInset,
                color: "#C9A8A8",
                fontSize: "12px",
                lineHeight: 1.45,
              }}
            >
              Incomplete fields required to enable shipping:{" "}
              {incompleteFields.join(", ")}.
            </div>
          ) : null}

          <div
            className="one-eyrie-hotel-property-panel__fields"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <label
              className="one-eyrie-hotel-property-panel__field"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: "8px",
                gridColumn: "1 / -1",
              }}
            >
              <input
                type="checkbox"
                checked={draft.shippingEnabled}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    shippingEnabled: event.target.checked,
                  }))
                }
              />
              <span style={{ textTransform: "none", letterSpacing: 0 }}>
                Enable Automated Shipping
              </span>
            </label>

            <label
              className="one-eyrie-hotel-property-panel__field"
              style={{ gridColumn: "1 / -1" }}
            >
              <span>Ship From Name</span>
              <input
                type="text"
                value={draft.senderName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    senderName: event.target.value,
                  }))
                }
                placeholder="Hotel Front Desk"
                style={fieldStyle}
              />
            </label>

            <div
              className="one-eyrie-hotel-property-panel__field"
              style={{ gridColumn: "1 / -1" }}
            >
              <AddressFields
                idPrefix="ship-from"
                variant="settings"
                value={draftToAddress(draft)}
                onChange={setAddress}
                inputStyle={fieldStyle}
                required
              />
            </div>

            <label className="one-eyrie-hotel-property-panel__field">
              <span>Phone Number</span>
              <input
                type="tel"
                value={draft.propertyPhone}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    propertyPhone: event.target.value,
                  }))
                }
                style={fieldStyle}
              />
              <span
                style={{
                  display: "block",
                  marginTop: "6px",
                  color: ONE_EYRIE.textSubtle,
                  fontSize: "11px",
                  lineHeight: 1.4,
                }}
              >
                Synced to this property’s hotel profile. Guests see this number
                automatically on the shipping page.
              </span>
            </label>

            <label className="one-eyrie-hotel-property-panel__field">
              <span>Return Email</span>
              <input
                type="email"
                value={draft.propertyEmail}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    propertyEmail: event.target.value,
                  }))
                }
                style={fieldStyle}
              />
              <span
                style={{
                  display: "block",
                  marginTop: "6px",
                  color: ONE_EYRIE.textSubtle,
                  fontSize: "11px",
                  lineHeight: 1.4,
                }}
              >
                Used for shipping operations. Not shown on the guest portal.
              </span>
            </label>

            <label className="one-eyrie-hotel-property-panel__field">
              <span>Default Package</span>
              <select
                value={draft.defaultPackagePreset}
                onChange={(event) =>
                  applyPreset(event.target.value as PackagePresetKey)
                }
                style={fieldStyle}
              >
                {PACKAGE_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="one-eyrie-hotel-property-panel__field">
              <span>Length</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={draft.defaultLengthIn ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    defaultLengthIn:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  }))
                }
                style={fieldStyle}
              />
            </label>

            <label className="one-eyrie-hotel-property-panel__field">
              <span>Width</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={draft.defaultWidthIn ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    defaultWidthIn:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  }))
                }
                style={fieldStyle}
              />
            </label>

            <label className="one-eyrie-hotel-property-panel__field">
              <span>Height</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={draft.defaultHeightIn ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    defaultHeightIn:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  }))
                }
                style={fieldStyle}
              />
            </label>

            <label className="one-eyrie-hotel-property-panel__field">
              <span>Weight</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={draft.defaultWeightOz ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    defaultWeightOz:
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                  }))
                }
                style={fieldStyle}
              />
            </label>

            <label
              className="one-eyrie-hotel-property-panel__field"
              style={futureFieldStyle}
              title="Coming soon"
            >
              <span>Preferred Carrier (future)</span>
              <select disabled style={fieldStyle} value="">
                <option value="">Not available yet</option>
              </select>
            </label>

            <label
              className="one-eyrie-hotel-property-panel__field"
              style={{
                ...futureFieldStyle,
                flexDirection: "row",
                alignItems: "center",
                gap: "8px",
              }}
              title="Coming soon"
            >
              <input type="checkbox" disabled checked={false} />
              <span style={{ textTransform: "none", letterSpacing: 0 }}>
                Signature Required (future)
              </span>
            </label>

            <label
              className="one-eyrie-hotel-property-panel__field"
              style={futureFieldStyle}
              title="Coming soon"
            >
              <span>Insurance Default (future)</span>
              <select disabled style={fieldStyle} value="">
                <option value="">Not available yet</option>
              </select>
            </label>
          </div>
        </>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_FOOTER,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  getPackagePreset,
  PACKAGE_PRESETS,
  type PackagePresetKey,
} from "@/app/lib/shipping/package-presets";
import {
  getShippingSettingsIncompleteFields,
  isShippingSettingsReady,
  type PropertyShippingSettings,
} from "@/app/lib/lost-found-shipping/property-shipping-settings";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import {
  forestHoverHandlers,
  NEUTRAL_BUTTON,
  neutralHoverHandlers,
  START_WORK_BUTTON,
} from "@/app/lib/oneEyrieButtons";

type SendShippingRequestModalProps = {
  open: boolean;
  item: { id: number; item_name?: string; guest_last_name?: string };
  onClose: () => void;
  onCreated: (result: { guestUrl: string; requestId?: number }) => void;
};

type FormState = {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  itemDescriptionPublic: string;
  internalNotes: string;
  packagePreset: PackagePresetKey;
  weightOz: string;
  lengthIn: string;
  widthIn: string;
  heightIn: string;
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  color: ONE_EYRIE.textSubtle,
  fontSize: "12px",
  fontWeight: 700,
  marginBottom: "6px",
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: "40px",
  padding: "0 12px",
  outline: "none",
  fontSize: "14px",
  fontWeight: 600,
  background: ONE_EYRIE.surfaceInset,
  border: `1px solid ${ONE_EYRIE.borderInput}`,
  borderRadius: "8px",
  color: ONE_EYRIE.text,
};

const emptyForm: FormState = {
  guestName: "",
  guestEmail: "",
  guestPhone: "",
  itemDescriptionPublic: "",
  internalNotes: "",
  packagePreset: "small_box",
  weightOz: "",
  lengthIn: "",
  widthIn: "",
  heightIn: "",
};

export default function SendShippingRequestModal({
  open,
  item,
  onClose,
  onCreated,
}: SendShippingRequestModalProps) {
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settings, setSettings] = useState<PropertyShippingSettings | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    setLoadingSettings(true);
    setSettingsError(null);
    setError(null);
    setSettings(null);
    setForm({
      ...emptyForm,
      guestName: item.guest_last_name || "",
      itemDescriptionPublic: item.item_name || "",
    });

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
        setSettings(loaded);
        const preset = getPackagePreset(loaded.defaultPackagePreset);
        setForm({
          guestName: item.guest_last_name || "",
          guestEmail: "",
          guestPhone: "",
          itemDescriptionPublic: item.item_name || "",
          internalNotes: "",
          packagePreset: loaded.defaultPackagePreset,
          weightOz: String(loaded.defaultWeightOz ?? preset.weightOz ?? ""),
          lengthIn: String(loaded.defaultLengthIn ?? preset.lengthIn ?? ""),
          widthIn: String(loaded.defaultWidthIn ?? preset.widthIn ?? ""),
          heightIn: String(loaded.defaultHeightIn ?? preset.heightIn ?? ""),
        });
        setLoadingSettings(false);
      })
      .catch((loadError) => {
        if (!mounted) return;
        setSettingsError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load shipping settings"
        );
        setLoadingSettings(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, item.id, item.guest_last_name, item.item_name]);

  if (!open) return null;

  const ready = settings ? isShippingSettingsReady(settings) : false;
  const missingFields = settings
    ? [
        ...(settings.shippingEnabled ? [] : ["Enable automated shipping"]),
        ...getShippingSettingsIncompleteFields(settings),
      ]
    : [];

  function applyPreset(key: PackagePresetKey) {
    const preset = getPackagePreset(key);
    setForm((current) => ({
      ...current,
      packagePreset: key,
      weightOz:
        preset.weightOz == null ? current.weightOz : String(preset.weightOz),
      lengthIn:
        preset.lengthIn == null ? current.lengthIn : String(preset.lengthIn),
      widthIn:
        preset.widthIn == null ? current.widthIn : String(preset.widthIn),
      heightIn:
        preset.heightIn == null ? current.heightIn : String(preset.heightIn),
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    try {
      const response = await tenantFetch(
        `/api/lost-and-found/${item.id}/shipping-requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestName: form.guestName,
            guestEmail: form.guestEmail,
            guestPhone: form.guestPhone,
            itemDescriptionPublic: form.itemDescriptionPublic,
            internalNotes: form.internalNotes,
            packagePreset: form.packagePreset,
            weightOz: Number(form.weightOz),
            lengthIn: Number(form.lengthIn),
            widthIn: Number(form.widthIn),
            heightIn: Number(form.heightIn),
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to create shipping request");
      }

      onCreated({
        guestUrl: String(result.guestUrl || ""),
        requestId: Number(result.request?.id) || undefined,
      });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create shipping request"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={ONE_EYRIE_MODAL_OVERLAY} onClick={onClose}>
      <div
        style={{ ...ONE_EYRIE_MODAL_BOX, maxHeight: "92vh", overflowY: "auto" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <h2 style={{ margin: 0, color: ONE_EYRIE.gold, fontSize: "20px" }}>
            Send Shipping Request
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={ONE_EYRIE_MODAL_CLOSE_BUTTON}
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        {loadingSettings ? (
          <p style={{ color: ONE_EYRIE.textSubtle, margin: 0 }}>
            Loading shipping settings…
          </p>
        ) : settingsError ? (
          <p style={{ color: "#C9A8A8", margin: 0 }}>{settingsError}</p>
        ) : !ready ? (
          <div>
            <p style={{ color: ONE_EYRIE.textRow, marginTop: 0, lineHeight: 1.5 }}>
              Automated shipping is not ready for this property. Complete the
              missing fields before sending a guest link.
            </p>
            {missingFields.length > 0 ? (
              <ul
                style={{
                  margin: "0 0 14px",
                  paddingLeft: "18px",
                  color: "#C9A8A8",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                {missingFields.map((field) => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            ) : null}
            <p style={{ color: ONE_EYRIE.gold, fontWeight: 700, margin: 0 }}>
              Complete Shipping Settings in Settings
            </p>
            <div style={ONE_EYRIE_MODAL_FOOTER}>
              <button
                type="button"
                onClick={onClose}
                style={NEUTRAL_BUTTON}
                className="one-eyrie-btn one-eyrie-btn--neutral one-eyrie-btn--md"
                {...neutralHoverHandlers()}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px 14px",
              }}
            >
              <label style={{ display: "block" }}>
                <span style={fieldLabel}>Guest name</span>
                <input
                  type="text"
                  value={form.guestName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      guestName: event.target.value,
                    }))
                  }
                  style={fieldInput}
                />
              </label>
              <label style={{ display: "block" }}>
                <span style={fieldLabel}>Guest email</span>
                <input
                  type="email"
                  value={form.guestEmail}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      guestEmail: event.target.value,
                    }))
                  }
                  style={fieldInput}
                />
              </label>
              <label style={{ display: "block" }}>
                <span style={fieldLabel}>Guest phone</span>
                <input
                  type="tel"
                  value={form.guestPhone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      guestPhone: event.target.value,
                    }))
                  }
                  style={fieldInput}
                />
              </label>
              <label style={{ display: "block" }}>
                <span style={fieldLabel}>Public item description</span>
                <input
                  type="text"
                  value={form.itemDescriptionPublic}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      itemDescriptionPublic: event.target.value,
                    }))
                  }
                  style={fieldInput}
                />
              </label>
              <label style={{ display: "block", gridColumn: "1 / -1" }}>
                <span style={fieldLabel}>Internal notes</span>
                <input
                  type="text"
                  value={form.internalNotes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      internalNotes: event.target.value,
                    }))
                  }
                  style={fieldInput}
                />
              </label>
              <label style={{ display: "block" }}>
                <span style={fieldLabel}>Package preset</span>
                <select
                  value={form.packagePreset}
                  onChange={(event) =>
                    applyPreset(event.target.value as PackagePresetKey)
                  }
                  style={fieldInput}
                >
                  {PACKAGE_PRESETS.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block" }}>
                <span style={fieldLabel}>Weight (oz)</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.weightOz}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      weightOz: event.target.value,
                    }))
                  }
                  style={fieldInput}
                />
              </label>
              <label style={{ display: "block" }}>
                <span style={fieldLabel}>Length (in)</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.lengthIn}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      lengthIn: event.target.value,
                    }))
                  }
                  style={fieldInput}
                />
              </label>
              <label style={{ display: "block" }}>
                <span style={fieldLabel}>Width (in)</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.widthIn}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      widthIn: event.target.value,
                    }))
                  }
                  style={fieldInput}
                />
              </label>
              <label style={{ display: "block" }}>
                <span style={fieldLabel}>Height (in)</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.heightIn}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      heightIn: event.target.value,
                    }))
                  }
                  style={fieldInput}
                />
              </label>
            </div>

            {error ? (
              <p style={{ color: "#C9A8A8", fontSize: "13px", marginTop: "14px" }}>
                {error}
              </p>
            ) : null}

            <div style={ONE_EYRIE_MODAL_FOOTER}>
              <button
                type="button"
                onClick={onClose}
                style={NEUTRAL_BUTTON}
                className="one-eyrie-btn one-eyrie-btn--neutral one-eyrie-btn--md"
                {...neutralHoverHandlers()}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                style={{
                  ...START_WORK_BUTTON,
                  opacity: submitting ? 0.6 : 1,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
                className="one-eyrie-btn one-eyrie-btn--forest one-eyrie-btn--md"
                {...(submitting ? {} : forestHoverHandlers())}
              >
                {submitting ? "Sending…" : "Send Request"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

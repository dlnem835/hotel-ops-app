"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  ONE_EYRIE_MODAL_BOX,
  ONE_EYRIE_MODAL_CLOSE_BUTTON,
  ONE_EYRIE_MODAL_FOOTER,
  ONE_EYRIE_MODAL_HEADER,
  ONE_EYRIE_MODAL_OVERLAY,
} from "@/app/lib/one-eyrie-modal-styles";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { readTenantJson, tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import {
  forestHoverHandlers,
  NEUTRAL_BUTTON,
  neutralHoverHandlers,
  START_WORK_BUTTON,
} from "@/app/lib/oneEyrieButtons";

type ResendShippingRequestModalProps = {
  open: boolean;
  item: {
    id: number;
    item_name?: string | null;
    guest_last_name?: string | null;
  };
  /** Prefill from Actions menu when already known. */
  initialGuestEmail?: string | null;
  initialGuestName?: string | null;
  onClose: () => void;
  onResent: (result: { guestEmail: string }) => void;
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

function isValidEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  return email.includes("@") && email.includes(".") && email.length >= 5;
}

export default function ResendShippingRequestModal({
  open,
  item,
  initialGuestEmail = "",
  initialGuestName = "",
  onClose,
  onResent,
}: ResendShippingRequestModalProps) {
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }

    if (!Number.isFinite(item.id) || item.id <= 0) {
      setError("Invalid item. Please close and try again.");
      setReady(true);
      setLoading(false);
      return;
    }

    let mounted = true;
    const prefillEmail = String(initialGuestEmail || "").trim();
    const prefillName = String(
      initialGuestName || item.guest_last_name || ""
    ).trim();

    setError(null);
    setGuestEmail(prefillEmail);
    setGuestName(prefillName);
    setLoading(!prefillEmail);
    setReady(Boolean(prefillEmail));

    void tenantFetch(`/api/lost-and-found/${item.id}/shipping-requests`)
      .then(async (response) => {
        const result = await readTenantJson<{
          error?: string;
          requests?: Array<{
            guestEmail?: string;
            guest_email?: string;
            guestName?: string;
            guest_name?: string;
            cancelledAt?: string | null;
            cancelled_at?: string | null;
          }>;
        }>(response);

        if (!response.ok) {
          throw new Error(result.error || "Unable to load shipping request");
        }

        const requests = result.requests || [];
        const active =
          requests.find((row) => !row.cancelledAt && !row.cancelled_at) ||
          requests[0] ||
          null;
        const email = String(
          active?.guestEmail || active?.guest_email || prefillEmail || ""
        ).trim();
        const name = String(
          active?.guestName ||
            active?.guest_name ||
            prefillName ||
            item.guest_last_name ||
            ""
        ).trim();

        if (!mounted) return;
        setGuestEmail(email);
        setGuestName(name);
        if (!email) {
          setError("No guest email is stored yet. Enter an email to resend.");
        }
      })
      .catch((loadError) => {
        if (!mounted) return;
        // Keep any prefilled email visible even if refresh failed.
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load shipping request"
        );
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
        setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, [
    open,
    item.id,
    item.guest_last_name,
    initialGuestEmail,
    initialGuestName,
  ]);

  async function handleSaveAndResend() {
    const email = guestEmail.trim().toLowerCase();
    if (!email) {
      setError("Enter a guest email address before resending.");
      inputRef.current?.focus();
      return;
    }
    if (!isValidEmail(email)) {
      setError("Enter a valid guest email address.");
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await tenantFetch(
        `/api/lost-and-found/${item.id}/guest-shipping`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestEmail: email,
            guestName: guestName || item.guest_last_name || "",
            itemDescriptionPublic: item.item_name || "",
          }),
        }
      );
      const result = await readTenantJson<{
        error?: string;
        missing?: string[];
        guestEmail?: string;
      }>(response);

      if (!response.ok) {
        const missing =
          Array.isArray(result.missing) && result.missing.length > 0
            ? ` Missing: ${result.missing.join(", ")}.`
            : "";
        throw new Error(
          `${result.error || "Unable to resend shipping request."}${missing}`
        );
      }

      onResent({
        guestEmail: String(result.guestEmail || email).trim().toLowerCase(),
      });
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to resend shipping request"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const canSubmit = isValidEmail(guestEmail) && !submitting && !loading;

  return (
    <div
      style={ONE_EYRIE_MODAL_OVERLAY}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        style={{
          ...ONE_EYRIE_MODAL_BOX,
          width: "460px",
          maxWidth: "calc(100vw - 24px)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={ONE_EYRIE_MODAL_HEADER}>
          <h2 style={{ margin: 0, color: ONE_EYRIE.gold, fontSize: "18px" }}>
            Resend Shipping Request
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

        {loading && !guestEmail ? (
          <p style={{ color: ONE_EYRIE.textSubtle, margin: 0 }}>
            Loading guest email…
          </p>
        ) : (
          <>
            <label style={{ display: "block", marginBottom: "8px" }}>
              <span style={fieldLabel}>Guest Email</span>
              <input
                ref={inputRef}
                type="email"
                value={guestEmail}
                onChange={(event) => {
                  setGuestEmail(event.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (canSubmit) void handleSaveAndResend();
                  }
                }}
                style={fieldInput}
                autoComplete="email"
                disabled={submitting}
                aria-label="Guest email"
                placeholder="guest@example.com"
              />
            </label>
            <p
              style={{
                margin: "0 0 4px",
                color: ONE_EYRIE.textSubtle,
                fontSize: "12px",
                lineHeight: 1.45,
              }}
            >
              You may update the email address before resending.
            </p>

            {error ? (
              <p
                role="alert"
                style={{ color: "#C9A8A8", fontSize: "13px", marginTop: "12px" }}
              >
                {error}
              </p>
            ) : null}

            <div style={ONE_EYRIE_MODAL_FOOTER}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={NEUTRAL_BUTTON}
                className="one-eyrie-btn one-eyrie-btn--neutral one-eyrie-btn--md"
                {...neutralHoverHandlers()}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void handleSaveAndResend()}
                style={{
                  ...START_WORK_BUTTON,
                  opacity: canSubmit ? 1 : 0.6,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                }}
                className="one-eyrie-btn one-eyrie-btn--forest one-eyrie-btn--md"
                {...(canSubmit ? forestHoverHandlers() : {})}
              >
                {submitting ? "Sending…" : "Save & Resend"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

/**
 * Manual prepaid-label fallback (UPS/FedEx/USPS + /label upload link).
 * Not used by the main Guest Shipping table action.
 */
export default function SendLabelRequestForm({
  itemId,
}: {
  itemId: number;
  id?: string;
}) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sendEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    setSending(true);
    setMessage(null);

    try {
      const link = `${window.location.origin}/label?id=${itemId}`;
      const res = await tenantFetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          link,
          itemId,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          payload?.error?.message ||
            payload?.error ||
            "Manual label email failed."
        );
      }

      setMessage("Manual label email sent.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Manual label email failed."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={(event) => void sendEmail(event)} className="one-eyrie-send-label-form">
      <input
        name="email"
        type="email"
        placeholder="Guest email"
        required
        disabled={sending}
        className="one-eyrie-field one-eyrie-field--compact"
      />
      <button
        type="submit"
        className="one-eyrie-send-label-form__btn"
        disabled={sending}
      >
        {sending ? "Sending…" : "Send Manual Link"}
      </button>
      {message ? (
        <span className="lnf-guest-shipping-feedback" role="status">
          {message}
        </span>
      ) : null}
    </form>
  );
}

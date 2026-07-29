"use client";

import { useState } from "react";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

type GuestShippingRequestFormProps = {
  itemId: number;
  guestLastName?: string;
  itemName?: string;
  /** Called after Resend accepts the guest shipping email. */
  onSent?: () => void;
};

/**
 * Table quick-send for automated guest shipping (Shippo/Stripe).
 * Does not use the old manual Send Label /api/send-email path.
 */
export default function GuestShippingRequestForm({
  itemId,
  guestLastName,
  itemName,
  onSent,
}: GuestShippingRequestFormProps) {
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "error";
    message: string;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    const form = event.currentTarget;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    const email = emailInput.value.trim();
    if (!email || !email.includes("@")) {
      setFeedback({
        type: "error",
        message: "Enter a valid guest email.",
      });
      return;
    }

    setSending(true);
    setFeedback(null);

    try {
      const response = await tenantFetch(
        `/api/lost-and-found/${itemId}/guest-shipping`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestEmail: email,
            guestName: guestLastName || "",
            itemDescriptionPublic: itemName || "",
          }),
        }
      );
      const result = await response.json();

      if (!response.ok) {
        const missing =
          Array.isArray(result.missing) && result.missing.length > 0
            ? ` Missing: ${result.missing.join(", ")}.`
            : "";
        throw new Error(
          `${result.error || "Unable to send guest shipping request."}${missing}`
        );
      }

      // Only show success after Resend acceptance (API returns ok only then).
      setFeedback({
        type: "ok",
        message: result.resent
          ? "Guest shipping email resent."
          : "Guest shipping email sent.",
      });
      onSent?.();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to send guest shipping request.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="one-eyrie-send-label-form"
      aria-busy={sending}
    >
      <input
        name="email"
        type="email"
        placeholder="Guest email"
        required
        disabled={sending}
        className="one-eyrie-field one-eyrie-field--compact"
        autoComplete="email"
      />
      <button
        type="submit"
        className="one-eyrie-send-label-form__btn"
        disabled={sending}
      >
        {sending ? "Sending…" : "Send Request"}
      </button>
      {feedback ? (
        <span
          className={
            feedback.type === "ok"
              ? "lnf-guest-shipping-feedback lnf-guest-shipping-feedback--ok"
              : "lnf-guest-shipping-feedback lnf-guest-shipping-feedback--error"
          }
          role="status"
        >
          {feedback.message}
        </span>
      ) : null}
    </form>
  );
}

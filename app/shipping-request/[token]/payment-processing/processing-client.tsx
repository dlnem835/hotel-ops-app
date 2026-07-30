"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GuestShippingRequestView } from "@/app/lib/lost-found-shipping/shipping-requests";
import "../../shipping-request.css";

function isPaymentConfirmed(state: GuestShippingRequestView["state"]): boolean {
  return (
    state === "payment_processing" ||
    state === "label_created" ||
    state === "in_transit" ||
    state === "delivered"
  );
}

export default function ShippingPaymentProcessingClient() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = String(params?.token || "");
  const sessionId = searchParams.get("session_id");

  const [view, setView] = useState<GuestShippingRequestView | null>(null);
  const [message, setMessage] = useState("Confirming your payment…");
  const [done, setDone] = useState(false);
  const redirectedRef = useRef(false);

  const load = useCallback(async () => {
    if (!token) return null;
    const response = await fetch(
      `/api/shipping-request/${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to load shipping request");
    }
    return result.request as GuestShippingRequestView;
  }, [token]);

  const reconcile = useCallback(async () => {
    if (!token || !sessionId) return null;
    const response = await fetch(
      `/api/shipping-request/${encodeURIComponent(token)}/checkout/reconcile`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        cache: "no-store",
      }
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { status: "error", error: result.error || "reconcile_failed" };
    }
    return result as {
      status: string;
      labelReady?: boolean;
      message?: string;
    };
  }, [token, sessionId]);

  const goToSuccess = useCallback(
    (nextMessage: string) => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      setDone(true);
      setMessage(nextMessage);
      window.setTimeout(() => {
        window.location.href = `/shipping-request/${encodeURIComponent(token)}`;
      }, 900);
    },
    [token]
  );

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;

    async function tick() {
      try {
        if (sessionId) {
          const reconciled = await reconcile();
          if (cancelled) return;
          if (reconciled && reconciled.status === "paid") {
            const next = await load();
            if (cancelled) return;
            if (next) setView(next);
            const labelReady =
              "labelReady" in reconciled ? Boolean(reconciled.labelReady) : false;
            goToSuccess(
              labelReady
                ? "Payment confirmed. Opening your shipment tracking…"
                : "Payment confirmed. Opening your shipping request…"
            );
            return;
          }
        }

        const next = await load();
        if (cancelled || !next) return;
        setView(next);

        if (isPaymentConfirmed(next.state)) {
          goToSuccess(
            next.state === "label_created" ||
              next.state === "in_transit" ||
              next.state === "delivered"
              ? "Payment confirmed. Opening your shipment tracking…"
              : "Payment confirmed. Opening your shipping request…"
          );
          return;
        }

        attempts += 1;
        if (attempts >= 30) {
          setMessage(
            "We’re still confirming your payment. You can safely close this window and return later with your shipping link."
          );
          return;
        }

        setMessage("Payment processing — waiting for secure confirmation…");
        timer = window.setTimeout(() => {
          void tick();
        }, 2500);
      } catch {
        if (cancelled) return;
        setMessage(
          "Unable to refresh payment status right now. Please keep this page open or return using your shipping link."
        );
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [load, reconcile, goToSuccess, sessionId]);

  const backHref = `/shipping-request/${encodeURIComponent(token)}`;

  return (
    <main className="shipping-request-page shipping-request-page--processing">
      <div className="shipping-request-shell">
        <div className="shipping-request-brand">
          <div className="shipping-request-hotel">
            <div className="shipping-request-hotel__monogram" aria-hidden>
              OE
            </div>
            <div>
              <div className="shipping-request-hotel__name">
                {view?.propertyName || "Hotel"}
              </div>
              <div className="shipping-request-hotel__meta">Secure checkout</div>
            </div>
          </div>
        </div>

        <div className="shipping-request-body">
          <div className="shipping-request-status-card shipping-request-status-card--processing">
            {!done ? (
              <div
                className="shipping-request-processing-spinner"
                role="status"
                aria-label="Processing payment"
              />
            ) : null}
            <h3>{done ? "All set" : "Processing payment"}</h3>
            <p>{message}</p>
            {!done ? (
              <div className="shipping-request-processing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            ) : null}
            {sessionId ? (
              <p style={{ marginTop: "8px", fontSize: "12px", opacity: 0.7 }}>
                Session reference received.
              </p>
            ) : null}
            <p style={{ marginTop: "16px" }}>
              <Link href={backHref}>Return to shipping request</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

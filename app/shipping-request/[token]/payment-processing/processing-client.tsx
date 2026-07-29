"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { GuestShippingRequestView } from "@/app/lib/lost-found-shipping/shipping-requests";
import "../../shipping-request.css";

export default function ShippingPaymentProcessingClient() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const token = String(params?.token || "");
  const sessionId = searchParams.get("session_id");

  const [view, setView] = useState<GuestShippingRequestView | null>(null);
  const [message, setMessage] = useState("Confirming your payment…");
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    if (!token) return null;
    const response = await fetch(`/api/shipping-request/${encodeURIComponent(token)}`);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to load shipping request");
    }
    return result.request as GuestShippingRequestView;
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function tick() {
      try {
        const next = await load();
        if (cancelled || !next) return;
        setView(next);

        if (
          next.state === "label_created" ||
          next.state === "in_transit" ||
          next.state === "delivered"
        ) {
          setDone(true);
          setMessage("Payment confirmed. Opening your shipment tracking…");
          window.setTimeout(() => {
            window.location.href = `/shipping-request/${encodeURIComponent(token)}`;
          }, 800);
          return;
        }

        if (next.state === "payment_processing") {
          setMessage(
            "Payment received. Creating your shipping label — this page will open tracking when ready…"
          );
          attempts += 1;
          if (attempts >= 30) {
            setDone(true);
            setMessage(
              "Your payment is confirmed. Open your shipping link anytime to check label and tracking status."
            );
            return;
          }
          window.setTimeout(() => {
            void tick();
          }, 2500);
          return;
        }

        attempts += 1;
        if (attempts >= 20) {
          setMessage(
            "We’re still confirming your payment. You can safely close this window and return later with your shipping link."
          );
          return;
        }

        setMessage("Payment processing — waiting for secure confirmation…");
        window.setTimeout(() => {
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
    };
  }, [load, token]);

  const backHref = `/shipping-request/${encodeURIComponent(token)}`;

  return (
    <main className="shipping-request-page">
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
          <div className="shipping-request-status-card">
            <h3>{done ? "All set" : "Processing payment"}</h3>
            <p>{message}</p>
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

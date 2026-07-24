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
          next.state === "payment_processing" ||
          next.state === "label_created" ||
          next.state === "in_transit" ||
          next.state === "delivered"
        ) {
          setDone(true);
          setMessage("Payment received. The hotel will prepare your shipment.");
          return;
        }

        attempts += 1;
        if (attempts >= 20) {
          setMessage(
            "We’re still confirming your payment. This page will update when Stripe verifies the charge. You can safely close this window and return later."
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
  }, [load]);

  const backHref = `/shipping-request/${encodeURIComponent(token)}`;

  return (
    <main className="shipping-request-page">
      <div className="shipping-request-shell">
        <div className="shipping-request-brand">
          <div className="shipping-request-hotel">
            <div className="shipping-request-hotel__monogram" aria-hidden="true">
              {(view?.propertyName || "H").slice(0, 2).toUpperCase()}
            </div>
            <div className="shipping-request-hotel__text">
              <p className="shipping-request-hotel__name">
                {view?.propertyName || "Hotel"}
              </p>
              <p className="shipping-request-brand__eyebrow">
                Lost &amp; Found Shipping
              </p>
            </div>
          </div>
        </div>
        <div className="shipping-request-body">
          <h1 className="shipping-request-title">
            {done ? "Shipping Payment Received" : "Payment processing"}
          </h1>
          <p className="shipping-request-copy">{message}</p>

          {done ? (
            <div className="shipping-request-status-card">
              <h3>Thank you. Your payment has been received.</h3>
              <p>
                The hotel will now prepare your item for shipment. You will receive
                tracking information after the shipping label is created and the
                package is sent.
              </p>
              <div style={{ marginTop: "14px", fontSize: "13px", color: "#c9c9c9" }}>
                <div>
                  <strong>Payment Received:</strong> complete
                </div>
                <div>
                  <strong>Preparing Shipment:</strong> current
                </div>
                <div>
                  <strong>Shipped:</strong> pending
                </div>
                <div>
                  <strong>Delivered:</strong> pending
                </div>
              </div>
              {view ? (
                <div style={{ marginTop: "14px", fontSize: "13px", color: "#e5e7eb" }}>
                  <div>{view.itemName}</div>
                  <div>
                    {[view.selectedCarrier, view.selectedService]
                      .filter(Boolean)
                      .join(" · ") || "Shipping option selected"}
                  </div>
                  {view.totalAmount != null ? (
                    <div>
                      Amount:{" "}
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: (view.currency || "usd").toUpperCase(),
                      }).format(view.totalAmount)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="shipping-request-status-card">
              <h3>Secure confirmation in progress</h3>
              <p>
                Browser return is not treated as proof of payment. We wait for
                Stripe’s verified webhook confirmation before marking this
                request paid.
              </p>
              {sessionId ? (
                <p style={{ marginTop: "10px", color: "#9ca3af", fontSize: "12px" }}>
                  Checkout reference received.
                </p>
              ) : null}
            </div>
          )}

          <div className="shipping-request-actions" style={{ marginTop: "18px" }}>
            <Link
              href={backHref}
              className="shipping-request-btn shipping-request-btn--secondary"
              style={{
                display: "grid",
                placeItems: "center",
                textDecoration: "none",
              }}
            >
              Back to shipping request
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

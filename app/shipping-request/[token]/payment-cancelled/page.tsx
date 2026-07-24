"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import "../../shipping-request.css";

export default function ShippingPaymentCancelledPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || "");
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    if (!token || recorded) return;
    void fetch(
      `/api/shipping-request/${encodeURIComponent(token)}/checkout-cancelled`,
      { method: "POST" }
    )
      .catch(() => null)
      .finally(() => setRecorded(true));
  }, [token, recorded]);

  const backHref = `/shipping-request/${encodeURIComponent(token)}`;

  return (
    <main className="shipping-request-page">
      <div className="shipping-request-shell">
        <div className="shipping-request-brand">
          <div className="shipping-request-hotel">
            <div className="shipping-request-hotel__monogram" aria-hidden="true">
              OE
            </div>
            <div className="shipping-request-hotel__text">
              <p className="shipping-request-hotel__name">Lost &amp; Found Shipping</p>
              <p className="shipping-request-brand__eyebrow">Secure checkout</p>
            </div>
          </div>
        </div>
        <div className="shipping-request-body">
          <h1 className="shipping-request-title">Payment not completed</h1>
          <p className="shipping-request-copy">
            Checkout was cancelled and no payment was collected. Your selected
            shipping option is still saved when the rate remains valid — you can
            try secure checkout again whenever you’re ready.
          </p>
          <div className="shipping-request-message shipping-request-message--info">
            No charge was made. Return to your shipping request to continue.
          </div>
          <div className="shipping-request-actions">
            <Link
              href={backHref}
              className="shipping-request-btn shipping-request-btn--primary"
              style={{
                display: "grid",
                placeItems: "center",
                textDecoration: "none",
              }}
            >
              Return to shipping options
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

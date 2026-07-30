"use client";

import { Suspense } from "react";
import ShippingPaymentProcessingClient from "./processing-client";

export default function ShippingPaymentProcessingPage() {
  return (
    <Suspense
      fallback={
        <main className="shipping-request-page shipping-request-page--processing">
          <div className="shipping-request-shell">
            <div className="shipping-request-body">
              <div className="shipping-request-status-card shipping-request-status-card--processing">
                <div
                  className="shipping-request-processing-spinner"
                  role="status"
                  aria-label="Confirming payment"
                />
                <p className="shipping-request-copy">Confirming your payment…</p>
              </div>
            </div>
          </div>
        </main>
      }
    >
      <ShippingPaymentProcessingClient />
    </Suspense>
  );
}

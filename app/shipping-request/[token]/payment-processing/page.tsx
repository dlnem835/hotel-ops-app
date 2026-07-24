"use client";

import { Suspense } from "react";
import ShippingPaymentProcessingClient from "./processing-client";

export default function ShippingPaymentProcessingPage() {
  return (
    <Suspense
      fallback={
        <main className="shipping-request-page">
          <div className="shipping-request-shell">
            <div className="shipping-request-body">
              <p className="shipping-request-copy">Confirming your payment…</p>
            </div>
          </div>
        </main>
      }
    >
      <ShippingPaymentProcessingClient />
    </Suspense>
  );
}

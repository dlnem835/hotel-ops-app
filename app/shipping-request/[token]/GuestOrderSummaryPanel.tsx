"use client";

import type { GuestShippingRequestView } from "@/app/lib/lost-found-shipping/shipping-requests";
import { displayCarrierServiceLabel } from "@/app/lib/lost-found-shipping/carrier-display";
import type { ShippingRate } from "@/app/lib/shipping/types";

export const CHECKOUT_UNAVAILABLE_MESSAGE =
  "Secure online payment is not yet available.";

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatEtaDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function rateEtaLabel(rate: ShippingRate): string {
  const dateLabel = formatEtaDate(rate.estimatedDeliveryDate);
  if (dateLabel && rate.estimatedDeliveryLabel) {
    return `${rate.estimatedDeliveryLabel} · Est. ${dateLabel}`;
  }
  if (dateLabel) return `Est. delivery ${dateLabel}`;
  if (rate.estimatedDeliveryLabel) return rate.estimatedDeliveryLabel;
  if (rate.estimatedDaysMin != null) {
    if (
      rate.estimatedDaysMax != null &&
      rate.estimatedDaysMax !== rate.estimatedDaysMin
    ) {
      return `${rate.estimatedDaysMin}–${rate.estimatedDaysMax} business days`;
    }
    return `${rate.estimatedDaysMin} business day${
      rate.estimatedDaysMin === 1 ? "" : "s"
    }`;
  }
  return "Delivery estimate unavailable";
}

export type GuestOrderSummaryPanelProps = {
  view: GuestShippingRequestView;
  selectedRate: ShippingRate | null;
  selectedRateId: string | null;
  totalDue: number | null;
  busy: boolean;
  ratesExpired: boolean;
  /** null = still unknown; only false shows the unavailable message */
  checkoutAvailable: boolean | null;
  onCheckout: () => void;
};

export default function GuestOrderSummaryPanel({
  view,
  selectedRate,
  selectedRateId,
  totalDue,
  busy,
  ratesExpired,
  checkoutAvailable,
  onCheckout,
}: GuestOrderSummaryPanelProps) {
  const checkoutReady = checkoutAvailable === true;
  const checkoutBlocked = checkoutAvailable === false;
  const checkoutPending = checkoutAvailable == null;

  return (
    <div
      className="shipping-request-order-summary"
      data-checkout-available={
        checkoutAvailable == null ? "unknown" : checkoutReady ? "true" : "false"
      }
    >
      <div className="shipping-request-order-summary__title">Order Summary</div>
      {selectedRateId && totalDue != null ? (
        <>
          <div className="shipping-request-order-summary__row">
            <span>Carrier</span>
            <strong>
              {displayCarrierServiceLabel(
                selectedRate?.carrier || view.selectedCarrier,
                "—"
              )}
            </strong>
          </div>
          <div className="shipping-request-order-summary__row">
            <span>Service</span>
            <strong>
              {displayCarrierServiceLabel(
                selectedRate?.service || view.selectedService,
                "—"
              )}
            </strong>
          </div>
          <div className="shipping-request-order-summary__row">
            <span>Estimated delivery</span>
            <strong>
              {selectedRate ? rateEtaLabel(selectedRate) : "—"}
            </strong>
          </div>
          <div className="shipping-request-order-summary__divider" />
          <div className="shipping-request-order-summary__row">
            <span>Shipping</span>
            <strong>
              {formatMoney(
                totalDue,
                selectedRate?.currency || view.currency
              )}
            </strong>
          </div>
          <div className="shipping-request-order-summary__total">
            <span>Total</span>
            <strong>
              {formatMoney(
                totalDue,
                selectedRate?.currency || view.currency
              )}
            </strong>
          </div>
        </>
      ) : (
        <p className="shipping-request-order-summary__empty">
          Select a shipping option to see your total.
        </p>
      )}
      <div className="shipping-request-actions shipping-request-actions--summary">
        <button
          type="button"
          className="shipping-request-btn shipping-request-btn--primary shipping-request-btn--with-lock"
          disabled={
            busy ||
            !checkoutReady ||
            !selectedRateId ||
            ratesExpired ||
            totalDue == null
          }
          onClick={onCheckout}
        >
          <span className="shipping-request-lock" aria-hidden="true">
            🔒
          </span>
          Continue to Secure Checkout
        </button>
        {checkoutReady ? (
          <p className="shipping-request-footnote">
            You’ll complete payment through Stripe’s secure checkout.
          </p>
        ) : checkoutPending ? (
          <p className="shipping-request-footnote">
            Checking payment availability…
          </p>
        ) : checkoutBlocked ? (
          <p className="shipping-request-footnote shipping-request-footnote--warn">
            {CHECKOUT_UNAVAILABLE_MESSAGE}
          </p>
        ) : null}
      </div>
    </div>
  );
}

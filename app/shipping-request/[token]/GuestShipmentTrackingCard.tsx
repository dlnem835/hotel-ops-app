"use client";

import type { GuestShippingRequestView } from "@/app/lib/lost-found-shipping/shipping-requests";
import { carrierTrackingStatusLabel } from "@/app/lib/lost-found-shipping/status";

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function guestHeadline(view: GuestShippingRequestView): {
  title: string;
  body: string;
} {
  if (view.state === "delivered") {
    return {
      title: "Delivered",
      body: view.deliveredAt
        ? `Your item was delivered on ${formatDateTime(view.deliveredAt)}.`
        : "Your item has been delivered. Thank you.",
    };
  }

  if (view.state === "in_transit") {
    return {
      title: "On the way",
      body: "Your item has been accepted by the carrier and is in transit.",
    };
  }

  // label_created / payment_processing with label / pre_transit
  const preTransit =
    !view.carrierTrackingStatus ||
    view.carrierTrackingStatus === "pre_transit" ||
    view.carrierTrackingStatus === "unknown";

  if (preTransit) {
    return {
      title: "Preparing for Shipment",
      body: "Your shipping label is ready. The carrier has not accepted the package yet.",
    };
  }

  return {
    title: "Shipment update",
    body: "Your shipment status has been updated.",
  };
}

export default function GuestShipmentTrackingCard({
  view,
}: {
  view: GuestShippingRequestView;
}) {
  const headline = guestHeadline(view);
  const trackingHref = view.trackingUrl || undefined;
  const statusLabel =
    view.state === "delivered"
      ? "Delivered"
      : view.state === "in_transit"
        ? "In transit"
        : view.carrierTrackingStatus === "pre_transit" ||
            !view.carrierTrackingStatus
          ? "Preparing for Shipment"
          : carrierTrackingStatusLabel(view.carrierTrackingStatus);

  return (
    <div className="shipping-request-status-card shipping-request-tracking-card">
      <h3>{headline.title}</h3>
      <p>{headline.body}</p>

      {view.returnedToSender ? (
        <div className="shipping-request-tracking-alert" role="alert">
          Returned to sender
          {view.shippingExceptionMessage
            ? ` — ${view.shippingExceptionMessage}`
            : ""}
        </div>
      ) : view.shippingExceptionMessage &&
        view.carrierTrackingStatus === "exception" ? (
        <div className="shipping-request-tracking-alert" role="alert">
          Shipping update: {view.shippingExceptionMessage}
        </div>
      ) : null}

      <dl className="shipping-request-tracking-grid">
        <div>
          <dt>Status</dt>
          <dd>{statusLabel}</dd>
        </div>
        <div>
          <dt>Carrier</dt>
          <dd>{view.selectedCarrier || "—"}</dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd>{view.selectedService || "—"}</dd>
        </div>
        <div>
          <dt>Tracking number</dt>
          <dd>
            {view.trackingNumber ? (
              trackingHref ? (
                <a href={trackingHref} target="_blank" rel="noreferrer">
                  {view.trackingNumber}
                </a>
              ) : (
                view.trackingNumber
              )
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div className="shipping-request-tracking-grid__full">
          <dt>Latest carrier update</dt>
          <dd>{view.latestCarrierUpdate || "Waiting for carrier updates…"}</dd>
        </div>
        <div>
          <dt>Estimated delivery</dt>
          <dd>{formatDateTime(view.estimatedDeliveryAt) || "—"}</dd>
        </div>
        {view.state === "delivered" || view.deliveredAt ? (
          <div>
            <dt>Delivered</dt>
            <dd>{formatDateTime(view.deliveredAt) || "Confirmed"}</dd>
          </div>
        ) : null}
        {view.shippedAt ? (
          <div>
            <dt>Shipped</dt>
            <dd>{formatDateTime(view.shippedAt)}</dd>
          </div>
        ) : null}
      </dl>

      <p className="shipping-request-tracking-note">
        You can return to this page anytime with your original shipping link to
        check progress. Updates appear automatically — no need to contact the
        hotel for tracking.
      </p>
    </div>
  );
}

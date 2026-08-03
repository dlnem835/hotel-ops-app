"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  LOST_ITEM_STATUS,
  normalizeLostItemStatus,
} from "@/app/lib/lost-found-shipping/status";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
type LostFoundShippingSectionProps = {
  itemId: number;
  itemName?: string;
  guestLastName?: string;
  itemStatus?: string | null;
  /** Manual prepaid label URL on the lost item, when present. */
  itemLabelUrl?: string | null;
  onItemMayHaveChanged?: () => void;
};

type ShippingRequestListItem = {
  id: number;
  guestName?: string;
  guestEmail: string;
  createdAt: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  shipmentStatus: string;
  selectedCarrier: string | null;
  selectedService: string | null;
  totalAmount: number | null;
  currency: string;
  destinationCity?: string | null;
  destinationState?: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrierTrackingStatus?: string | null;
  shippingExceptionCode?: string | null;
  shippingExceptionMessage?: string | null;
  returnedToSender?: boolean;
  labelPrintedAt?: string | null;
  labelCreatedAt?: string | null;
  labelStoragePath?: string | null;
  estimatedDeliveryAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  paidAt?: string | null;
  amountPaid?: number | null;
  cancelledAt?: string | null;
  errorMessage?: string | null;
};

function formatMoney(amount: number | null, currency: string): string {
  if (amount == null || !Number.isFinite(amount)) return "Not available";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatLocalDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Hide Shippo placeholder strings that were stored when rate expand failed. */
function displayCarrierOrService(value: string | null | undefined): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "Not available";
  if (/^(carrier|service)$/i.test(trimmed)) return "Not available";
  return trimmed;
}

function paymentLabel(status: string): string {
  if (status === "paid") return "Paid";
  if (status === "failed") return "Failed";
  if (status === "expired") return "Expired";
  return "Awaiting payment";
}

function labelStatusLabel(request: ShippingRequestListItem): string {
  if (
    request.fulfillmentStatus === "label_ready" ||
    request.labelCreatedAt ||
    request.labelStoragePath
  ) {
    return "Created";
  }
  if (
    request.paymentStatus === "paid" &&
    request.fulfillmentStatus === "needs_manual_review"
  ) {
    return "Payment received — label creation failed";
  }
  if (request.paymentStatus === "paid") {
    return "Payment received — preparing shipping label.";
  }
  return "Not created";
}

function hasUsableLabel(
  request: ShippingRequestListItem | null,
  itemLabelUrl?: string | null
): boolean {
  if (itemLabelUrl) return true;
  if (!request) return false;
  return Boolean(request.labelStoragePath);
}

function SummaryField({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: ReactNode;
}) {
  return (
    <div className="lnf-shipping-summary__field">
      <dt>{label}</dt>
      <dd>{valueNode ?? value}</dd>
    </div>
  );
}

function linkButtonStyle(): CSSProperties {
  return {
    border: `1px solid ${ONE_EYRIE.gold}`,
    background: "transparent",
    color: ONE_EYRIE.gold,
    borderRadius: "8px",
    height: "30px",
    padding: "0 10px",
    fontWeight: 700,
    fontSize: "12px",
    cursor: "pointer",
  };
}

export default function LostFoundShippingSection({
  itemId,
  itemStatus,
  itemLabelUrl,
  onItemMayHaveChanged,
}: LostFoundShippingSectionProps) {
  const [requests, setRequests] = useState<ShippingRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guestLinks, setGuestLinks] = useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<number | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const workflowStatus =
    normalizeLostItemStatus(itemStatus) ||
    String(itemStatus || LOST_ITEM_STATUS.stored);

  const activeRequest = useMemo(() => {
    return (
      requests.find((request) => !request.cancelledAt) || requests[0] || null
    );
  }, [requests]);

  const loadRequests = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!options?.quiet) {
        setLoading(true);
        setError(null);
      }
      try {
        const response = await tenantFetch(
          `/api/lost-and-found/${itemId}/shipping-requests`
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Unable to load shipping requests");
        }
        setRequests((result.requests || []) as ShippingRequestListItem[]);
        if (options?.quiet) onItemMayHaveChanged?.();
      } catch (loadError) {
        if (!options?.quiet) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load shipping requests"
          );
          setRequests([]);
        }
      } finally {
        if (!options?.quiet) setLoading(false);
      }
    },
    [itemId, onItemMayHaveChanged]
  );

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    const active = requests.some(
      (request) =>
        ["label_ready", "in_transit", "awaiting_payment", "awaiting_guest"].includes(
          request.shipmentStatus
        ) ||
        request.paymentStatus === "paid" ||
        request.fulfillmentStatus === "label_ready" ||
        request.fulfillmentStatus === "needs_manual_review" ||
        request.fulfillmentStatus === "pending"
    );
    if (!active) return;
    const timer = window.setInterval(() => {
      void loadRequests({ quiet: true });
    }, 12000);
    return () => window.clearInterval(timer);
  }, [requests, loadRequests]);

  async function ensureGuestLink(requestId: number): Promise<string> {
    const existing = guestLinks[requestId];
    if (existing) return existing;

    setLinkBusyId(requestId);
    try {
      const response = await tenantFetch(
        `/api/lost-and-found/${itemId}/shipping-requests/${requestId}/guest-link`,
        { method: "POST" }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to issue guest link");
      }
      const url = String(result.guestUrl || "");
      if (!url) throw new Error("Guest link missing from response");
      setGuestLinks((current) => ({ ...current, [requestId]: url }));
      await loadRequests();
      return url;
    } finally {
      setLinkBusyId(null);
    }
  }

  async function copyGuestLink(requestId: number) {
    try {
      const url = await ensureGuestLink(requestId);
      await navigator.clipboard.writeText(url);
      setCopiedId(requestId);
      window.setTimeout(
        () => setCopiedId((current) => (current === requestId ? null : current)),
        2000
      );
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : "Unable to copy guest link"
      );
    }
  }

  async function openGuestTrackingPage(requestId: number) {
    try {
      // Always open the One Eyrie guest tracking page — never the carrier site.
      const url = await ensureGuestLink(requestId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Unable to open shipment tracking"
      );
    }
  }

  async function markPrinted(request: ShippingRequestListItem) {
    setActionBusy("printed");
    try {
      const response = await tenantFetch(
        `/api/lost-and-found/${itemId}/shipping-requests/${request.id}/mark-printed`,
        { method: "POST" }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to mark label printed");
      }
      await loadRequests();
    } catch (printError) {
      setError(
        printError instanceof Error
          ? printError.message
          : "Unable to mark label printed"
      );
    } finally {
      setActionBusy(null);
    }
  }

  async function retryLabel(request: ShippingRequestListItem) {
    setActionBusy("retry-label");
    setError(null);
    try {
      const response = await tenantFetch(
        `/api/lost-and-found/${itemId}/shipping-requests/${request.id}/retry-label`,
        { method: "POST" }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to retry label creation");
      }
      await loadRequests();
      onItemMayHaveChanged?.();
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Unable to retry label creation"
      );
    } finally {
      setActionBusy(null);
    }
  }

  const destination =
    activeRequest?.destinationCity || activeRequest?.destinationState
      ? [activeRequest.destinationCity, activeRequest.destinationState]
          .filter(Boolean)
          .join(", ")
      : "Not available";

  const linkBusy = activeRequest ? linkBusyId === activeRequest.id : false;

  return (
    <section className="lnf-shipping-section" aria-label="Shipping summary">
      <div className="lnf-shipping-section__header">
        <h3 className="lnf-shipping-section__title">Shipping Summary</h3>
      </div>

      <div className="lnf-shipping-section__body">
        {loading ? (
          <div
            className="lnf-shipping-summary lnf-shipping-summary--skeleton"
            aria-busy="true"
          >
            <p className="lnf-shipping-section__empty">
              Loading shipping details…
            </p>
            <dl className="lnf-shipping-summary__grid">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="lnf-shipping-summary__field">
                  <dt>
                    <span className="lnf-shipping-skeleton-line lnf-shipping-skeleton-line--label" />
                  </dt>
                  <dd>
                    <span className="lnf-shipping-skeleton-line" />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : error ? (
          <p className="lnf-shipping-section__error">{error}</p>
        ) : !activeRequest ? (
          <p className="lnf-shipping-section__empty">
            No shipping request yet. Use Actions → Send Shipping Request when
            the guest is ready to arrange return shipping.
          </p>
        ) : (
          <div className="lnf-shipping-summary">
            {(activeRequest.returnedToSender ||
              activeRequest.shippingExceptionCode ||
              activeRequest.shippingExceptionMessage ||
              (activeRequest.paymentStatus === "paid" &&
                activeRequest.fulfillmentStatus === "needs_manual_review")) && (
              <div
                role="alert"
                className={`lnf-shipping-summary__alert${
                  activeRequest.returnedToSender
                    ? " lnf-shipping-summary__alert--danger"
                    : " lnf-shipping-summary__alert--warn"
                }`}
              >
                {activeRequest.paymentStatus === "paid" &&
                activeRequest.fulfillmentStatus === "needs_manual_review"
                  ? `Payment received — label creation failed. Hotel has been notified.${
                      activeRequest.errorMessage
                        ? ` ${activeRequest.errorMessage}`
                        : ""
                    }`
                  : activeRequest.returnedToSender
                    ? "Returned to sender"
                    : "Shipping exception"}
                {activeRequest.paymentStatus === "paid" &&
                activeRequest.fulfillmentStatus === "needs_manual_review"
                  ? ""
                  : activeRequest.shippingExceptionMessage
                    ? `: ${activeRequest.shippingExceptionMessage}`
                    : ""}
              </div>
            )}

            <dl className="lnf-shipping-summary__grid">
              <SummaryField
                label="Guest email"
                value={activeRequest.guestEmail || "Not available"}
              />
              <SummaryField label="Destination" value={destination} />
              <SummaryField
                label="Carrier"
                value={displayCarrierOrService(activeRequest.selectedCarrier)}
              />
              <SummaryField
                label="Estimated delivery"
                value={formatLocalDate(activeRequest.estimatedDeliveryAt)}
              />
              <SummaryField
                label="Shipping cost"
                value={formatMoney(
                  activeRequest.amountPaid ?? activeRequest.totalAmount,
                  activeRequest.currency
                )}
              />
              <SummaryField
                label="Payment status"
                value={paymentLabel(activeRequest.paymentStatus)}
              />
              <SummaryField
                label="Label status"
                value={labelStatusLabel(activeRequest)}
              />
              <SummaryField
                label="Printed status"
                value={
                  activeRequest.labelPrintedAt
                    ? formatLocalDate(activeRequest.labelPrintedAt)
                    : "Not printed"
                }
              />
              <SummaryField
                label="Tracking number"
                valueNode={
                  activeRequest.trackingNumber ? (
                    activeRequest.trackingUrl ? (
                      <a
                        href={activeRequest.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="lnf-shipping-summary__link"
                      >
                        {activeRequest.trackingNumber}
                      </a>
                    ) : (
                      activeRequest.trackingNumber
                    )
                  ) : (
                    "Not available"
                  )
                }
              />
              <SummaryField
                label="Delivered date"
                value={
                  activeRequest.deliveredAt
                    ? formatLocalDate(activeRequest.deliveredAt)
                    : activeRequest.shipmentStatus === "delivered"
                      ? "Delivered"
                      : "Not available"
                }
              />
            </dl>

            <div className="lnf-shipping-summary__actions">
              <button
                type="button"
                style={linkButtonStyle()}
                disabled={linkBusy}
                onClick={() => void openGuestTrackingPage(activeRequest.id)}
              >
                View Shipment Tracking
              </button>
              <button
                type="button"
                style={linkButtonStyle()}
                disabled={linkBusy}
                onClick={() => void copyGuestLink(activeRequest.id)}
              >
                {copiedId === activeRequest.id
                  ? "Copied"
                  : linkBusy
                    ? "Preparing…"
                    : "Copy Guest Link"}
              </button>
              {activeRequest.paymentStatus === "paid" &&
              activeRequest.fulfillmentStatus === "needs_manual_review" ? (
                <button
                  type="button"
                  style={linkButtonStyle()}
                  disabled={actionBusy === "retry-label"}
                  onClick={() => void retryLabel(activeRequest)}
                >
                  {actionBusy === "retry-label"
                    ? "Retrying…"
                    : "Retry Label Creation"}
                </button>
              ) : null}
              {hasUsableLabel(activeRequest, itemLabelUrl) &&
              !activeRequest.labelPrintedAt &&
              workflowStatus === LOST_ITEM_STATUS.readyToShip ? (
                <button
                  type="button"
                  style={linkButtonStyle()}
                  disabled={actionBusy === "printed"}
                  onClick={() => void markPrinted(activeRequest)}
                >
                  {actionBusy === "printed" ? "Saving…" : "Mark Label Printed"}
                </button>
              ) : null}
              {hasUsableLabel(activeRequest, itemLabelUrl) ? (
                <button
                  type="button"
                  style={linkButtonStyle()}
                  disabled={actionBusy === "print-label"}
                  onClick={() => {
                    void (async () => {
                      setActionBusy("print-label");
                      try {
                        const response = await tenantFetch(
                          `/api/lost-and-found/${itemId}/shipping-requests/${activeRequest.id}/label`
                        );
                        const result = await response.json();
                        if (!response.ok) {
                          throw new Error(
                            result.error || "Unable to open shipping label"
                          );
                        }
                        if (result.url) {
                          window.open(
                            String(result.url),
                            "_blank",
                            "noopener,noreferrer"
                          );
                        }
                      } catch (labelError) {
                        setError(
                          labelError instanceof Error
                            ? labelError.message
                            : "Unable to open shipping label"
                        );
                      } finally {
                        setActionBusy(null);
                      }
                    })();
                  }}
                >
                  Print Label
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

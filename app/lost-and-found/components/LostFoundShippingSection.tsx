"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  buildStaffTimelineDisplay,
  formatRelativeTimestamp,
  guestLastViewedFromTimeline,
  type TimelineTone,
} from "@/app/lib/lost-found-shipping/timeline-ui";
import {
  carrierTrackingStatusLabel,
  type ShippingCurrentStep,
} from "@/app/lib/lost-found-shipping/status";
import type { ShippingUiBadge } from "@/app/lib/shipping/types";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import {
  forestHoverHandlers,
  START_WORK_BUTTON,
} from "@/app/lib/oneEyrieButtons";
import LostFoundShippingBadge from "./LostFoundShippingBadge";
import SendShippingRequestModal from "./SendShippingRequestModal";

type LostFoundShippingSectionProps = {
  itemId: number;
  itemName?: string;
  guestLastName?: string;
  /** Called when shipping data may have changed lost item status (e.g. Shippo webhooks). */
  onItemMayHaveChanged?: () => void;
};

type ShippingTimelineEntry = {
  id: number;
  eventType: string;
  label: string;
  actorLabel: string;
  createdAt: string;
  notes: string | null;
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
  estimatedDeliveryAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  paidAt?: string | null;
  amountPaid?: number | null;
  stripePaymentRef?: string | null;
  providerReceiptUrl?: string | null;
  badge: ShippingUiBadge | string;
  currentStep?: ShippingCurrentStep | string;
  timeline?: ShippingTimelineEntry[];
};

const NOTES_COLLAPSE_CHARS = 90;

function formatMoney(amount: number | null, currency: string): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function toneStyles(tone: TimelineTone): {
  border: string;
  dot: string;
  label: string;
} {
  switch (tone) {
    case "completed":
      return { border: "#2f6b4f", dot: "#4ade80", label: "#BBF7D0" };
    case "current":
      return { border: "#1d4ed8", dot: "#60a5fa", label: "#BFDBFE" };
    case "failed":
      return { border: "#7f1d1d", dot: "#f87171", label: "#FECACA" };
    default:
      return { border: "#555048", dot: "#6b7280", label: "#9ca3af" };
  }
}

function TimelineNotes({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = notes.length > NOTES_COLLAPSE_CHARS;
  const shown =
    !long || expanded ? notes : `${notes.slice(0, NOTES_COLLAPSE_CHARS).trim()}…`;

  return (
    <div style={{ marginTop: "4px" }}>
      <div
        style={{
          color: ONE_EYRIE.textSubtle,
          fontSize: "11px",
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
        }}
      >
        {shown}
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          style={{
            marginTop: "4px",
            border: "none",
            background: "transparent",
            color: ONE_EYRIE.gold,
            fontSize: "11px",
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

function ShippingTimelinePanel({
  timeline,
}: {
  timeline: ShippingTimelineEntry[];
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLOListElement | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () => buildStaffTimelineDisplay({ events: timeline }),
    [timeline]
  );

  const newestEventRow = useMemo(() => {
    const events = rows.filter((row) => row.kind === "event" && row.createdAt);
    return events.length > 0 ? events[events.length - 1] : null;
  }, [rows]);

  useEffect(() => {
    if (!open) return;
    const eventIds = rows
      .filter((row) => row.kind === "event")
      .map((row) => row.id);
    const fresh = eventIds.filter((id) => !seenEventIdsRef.current.has(id));
    for (const id of eventIds) seenEventIdsRef.current.add(id);
    if (fresh.length === 0) return;

    setFlashIds(new Set(fresh));
    const timer = window.setTimeout(() => setFlashIds(new Set()), 1800);

    window.requestAnimationFrame(() => {
      const newestId = newestEventRow?.id;
      if (!newestId || !listRef.current) return;
      const node = listRef.current.querySelector(
        `[data-timeline-row="${newestId}"]`
      );
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    return () => window.clearTimeout(timer);
  }, [open, rows, newestEventRow?.id]);

  return (
    <div style={{ marginTop: "12px" }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          border: `1px solid ${ONE_EYRIE.border}`,
          background: ONE_EYRIE.surfaceInset,
          color: ONE_EYRIE.gold,
          borderRadius: "8px",
          padding: "8px 10px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.4px",
        }}
      >
        <span>SHIPPING TIMELINE</span>
        <span style={{ color: ONE_EYRIE.textSubtle, fontWeight: 700 }}>
          {open ? "Hide" : "Show"}
          {timeline.length > 0
            ? ` · ${timeline.length} event${timeline.length === 1 ? "" : "s"}`
            : " · pending"}
        </span>
      </button>

      {open ? (
        <ol
          ref={listRef}
          style={{
            listStyle: "none",
            margin: "10px 0 0",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {rows.map((row) => {
            const colors = toneStyles(row.tone);
            const exact =
              row.createdAt && !Number.isNaN(new Date(row.createdAt).getTime())
                ? new Date(row.createdAt).toLocaleString()
                : null;
            const pending = row.kind === "milestone" || !row.createdAt;
            const flashing = flashIds.has(row.id);
            return (
              <li
                key={row.id}
                data-timeline-row={row.id}
                style={{
                  display: "flex",
                  gap: "10px",
                  borderLeft: `3px solid ${colors.border}`,
                  paddingLeft: "10px",
                  paddingTop: "4px",
                  paddingBottom: "4px",
                  borderRadius: "8px",
                  background: flashing
                    ? "rgba(96, 165, 250, 0.28)"
                    : "transparent",
                  transition: "background 1.4s ease-out",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "18px",
                    marginTop: "1px",
                    fontSize: "13px",
                    lineHeight: 1.2,
                    flexShrink: 0,
                  }}
                >
                  {row.icon}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        color: colors.label,
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {row.label}
                    </div>
                    {pending ? (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: "#9ca3af",
                          border: "1px solid #555048",
                          borderRadius: "999px",
                          padding: "1px 7px",
                        }}
                      >
                        Pending
                      </span>
                    ) : null}
                  </div>
                  <div
                    style={{
                      color: ONE_EYRIE.textSubtle,
                      fontSize: "11px",
                      marginTop: "2px",
                      lineHeight: 1.4,
                    }}
                    title={exact || undefined}
                  >
                    {row.createdAt ? (
                      <>
                        <span>{formatRelativeTimestamp(row.createdAt)}</span>
                        {exact ? (
                          <span style={{ opacity: 0.85 }}> · {exact}</span>
                        ) : null}
                      </>
                    ) : (
                      "Not yet recorded"
                    )}
                    {row.actor ? ` · ${row.actor}` : ""}
                  </div>
                  {row.notes ? <TimelineNotes notes={row.notes} /> : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
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
    fontWeight: 800,
    fontSize: "12px",
    cursor: "pointer",
  };
}

export default function LostFoundShippingSection({
  itemId,
  itemName,
  guestLastName,
  onItemMayHaveChanged,
}: LostFoundShippingSectionProps) {
  const [requests, setRequests] = useState<ShippingRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [guestLinks, setGuestLinks] = useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<number | null>(null);

  const loadRequests = useCallback(async (options?: { quiet?: boolean }) => {
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
  }, [itemId, onItemMayHaveChanged]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  // Refresh while shipments are active so Shippo webhook updates appear on staff UI.
  useEffect(() => {
    const active = requests.some(
      (request) =>
        ["label_ready", "in_transit", "awaiting_payment", "awaiting_guest"].includes(
          request.shipmentStatus
        ) ||
        request.paymentStatus === "paid" ||
        request.fulfillmentStatus === "label_ready" ||
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
      window.setTimeout(() => setCopiedId((current) => (current === requestId ? null : current)), 2000);
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : "Unable to copy guest link"
      );
    }
  }

  async function openGuestPage(requestId: number) {
    try {
      const url = await ensureGuestLink(requestId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "Unable to open guest page"
      );
    }
  }

  return (
    <section
      style={{
        marginTop: "18px",
        paddingTop: "16px",
        borderTop: `1px solid ${ONE_EYRIE.borderDivider}`,
      }}
      aria-label="Automated shipping"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          marginBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              color: ONE_EYRIE.gold,
              fontSize: "14px",
              fontWeight: 800,
              letterSpacing: "0.3px",
            }}
          >
            Automated Shipping
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              color: ONE_EYRIE.textSubtle,
              fontSize: "12px",
            }}
          >
            Guest pays carrier rates via link. Distinct from manual Send Label.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            ...START_WORK_BUTTON,
            height: "34px",
            padding: "0 12px",
            fontSize: "12px",
          }}
          className="one-eyrie-btn one-eyrie-btn--forest one-eyrie-btn--sm"
          {...forestHoverHandlers()}
        >
          Send Shipping Request
        </button>
      </div>

      {loading ? (
        <p style={{ color: ONE_EYRIE.textSubtle, fontSize: "13px", margin: 0 }}>
          Loading shipping requests…
        </p>
      ) : error ? (
        <p style={{ color: "#C9A8A8", fontSize: "13px", margin: 0 }}>{error}</p>
      ) : requests.length === 0 ? (
        <p style={{ color: ONE_EYRIE.textSubtle, fontSize: "13px", margin: 0 }}>
          No automated shipping requests yet.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {requests.map((request) => {
            const destination =
              request.destinationCity || request.destinationState
                ? [request.destinationCity, request.destinationState]
                    .filter(Boolean)
                    .join(", ")
                : null;
            const lastViewed = guestLastViewedFromTimeline(
              (request.timeline || []).map((entry) => ({
                eventType: entry.eventType,
                createdAt: entry.createdAt,
              }))
            );
            const linkBusy = linkBusyId === request.id;

            return (
              <li
                key={request.id}
                style={{
                  background: ONE_EYRIE.row,
                  border: `1px solid ${ONE_EYRIE.border}`,
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      alignItems: "center",
                    }}
                  >
                    {request.currentStep ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          height: "24px",
                          padding: "0 10px",
                          borderRadius: "999px",
                          background: "#1E3A5F",
                          border: "1px solid #60A5FA",
                          color: "#BFDBFE",
                          fontSize: "11px",
                          fontWeight: 800,
                        }}
                      >
                        Current Step: {request.currentStep}
                      </span>
                    ) : null}
                    <LostFoundShippingBadge badge={String(request.badge)} />
                  </div>
                  <span style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px" }}>
                    {request.createdAt
                      ? new Date(request.createdAt).toLocaleString()
                      : "—"}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "4px",
                    fontSize: "12px",
                    lineHeight: 1.45,
                  }}
                >
                  {request.returnedToSender ? (
                    <div
                      role="alert"
                      style={{
                        marginBottom: "4px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #F87171",
                        background: "#3F1D1D",
                        color: "#FECACA",
                        fontWeight: 700,
                      }}
                    >
                      Returned to Sender
                      {request.shippingExceptionMessage
                        ? ` — ${request.shippingExceptionMessage}`
                        : ""}
                    </div>
                  ) : request.shippingExceptionCode ||
                    request.shippingExceptionMessage ? (
                    <div
                      role="alert"
                      style={{
                        marginBottom: "4px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #FBBF24",
                        background: "#3B2F14",
                        color: "#FDE68A",
                        fontWeight: 700,
                      }}
                    >
                      Shipping Exception
                      {request.shippingExceptionMessage
                        ? ` — ${request.shippingExceptionMessage}`
                        : ""}
                    </div>
                  ) : null}
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>Guest: </span>
                    {request.guestName || request.guestEmail || "No guest email"}
                    {request.guestName && request.guestEmail
                      ? ` (${request.guestEmail})`
                      : ""}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Destination:{" "}
                    </span>
                    {destination || "Not provided yet"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Carrier and service:{" "}
                    </span>
                    {[request.selectedCarrier, request.selectedService]
                      .filter(Boolean)
                      .join(" · ") || "Not selected yet"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Tracking:{" "}
                    </span>
                    {request.trackingNumber ? (
                      request.trackingUrl ? (
                        <a
                          href={request.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: ONE_EYRIE.gold, fontWeight: 700 }}
                        >
                          {request.trackingNumber}
                        </a>
                      ) : (
                        request.trackingNumber
                      )
                    ) : (
                      "—"
                    )}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Payment status:{" "}
                    </span>
                    {request.paymentStatus === "paid"
                      ? "Payment Received"
                      : request.paymentStatus === "failed"
                        ? "Failed"
                        : request.paymentStatus === "expired"
                          ? "Expired"
                          : "Awaiting payment"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Label status:{" "}
                    </span>
                    {request.fulfillmentStatus === "label_ready" ||
                    request.labelCreatedAt
                      ? "Label ready"
                      : request.paymentStatus === "paid"
                        ? "Awaiting label purchase"
                        : "Not created"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Printed status:{" "}
                    </span>
                    {request.labelPrintedAt
                      ? `Printed ${new Date(request.labelPrintedAt).toLocaleString()}`
                      : "Not printed"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Current carrier status:{" "}
                    </span>
                    {carrierTrackingStatusLabel(request.carrierTrackingStatus)}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Shipping amount:{" "}
                    </span>
                    {formatMoney(request.totalAmount, request.currency)}
                  </div>
                  {request.paymentStatus === "paid" ? (
                    <>
                      <div style={{ color: ONE_EYRIE.textRow }}>
                        <span style={{ color: ONE_EYRIE.textSubtle }}>
                          Amount paid:{" "}
                        </span>
                        {formatMoney(
                          request.amountPaid ?? request.totalAmount,
                          request.currency
                        )}
                      </div>
                      <div style={{ color: ONE_EYRIE.textRow }}>
                        <span style={{ color: ONE_EYRIE.textSubtle }}>
                          Paid at:{" "}
                        </span>
                        {request.paidAt
                          ? new Date(request.paidAt).toLocaleString()
                          : "—"}
                      </div>
                      <div style={{ color: ONE_EYRIE.textRow }}>
                        <span style={{ color: ONE_EYRIE.textSubtle }}>
                          Stripe reference:{" "}
                        </span>
                        {request.stripePaymentRef || "—"}
                      </div>
                      {request.providerReceiptUrl ? (
                        <div style={{ color: ONE_EYRIE.textRow }}>
                          <span style={{ color: ONE_EYRIE.textSubtle }}>
                            Receipt:{" "}
                          </span>
                          <a
                            href={request.providerReceiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: ONE_EYRIE.gold, fontWeight: 700 }}
                          >
                            View Stripe receipt
                          </a>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Shipped date:{" "}
                    </span>
                    {request.shippedAt
                      ? new Date(request.shippedAt).toLocaleString()
                      : "—"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Estimated delivery:{" "}
                    </span>
                    {request.estimatedDeliveryAt
                      ? new Date(request.estimatedDeliveryAt).toLocaleString()
                      : "—"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Delivered:{" "}
                    </span>
                    {request.deliveredAt
                      ? new Date(request.deliveredAt).toLocaleString()
                      : request.shipmentStatus === "delivered"
                        ? "Delivered"
                        : "—"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Guest viewed:{" "}
                    </span>
                    {lastViewed
                      ? `${formatRelativeTimestamp(lastViewed)} (${new Date(
                          lastViewed
                        ).toLocaleString()})`
                      : "Guest has not viewed request."}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginTop: "10px",
                  }}
                >
                  <button
                    type="button"
                    style={linkButtonStyle()}
                    disabled={linkBusy}
                    onClick={() => void copyGuestLink(request.id)}
                  >
                    {copiedId === request.id
                      ? "Copied"
                      : linkBusy
                        ? "Preparing…"
                        : "Copy Guest Link"}
                  </button>
                  <button
                    type="button"
                    style={linkButtonStyle()}
                    disabled={linkBusy}
                    onClick={() => void openGuestPage(request.id)}
                  >
                    Open Guest Page
                  </button>
                </div>

                <ShippingTimelinePanel timeline={request.timeline || []} />
              </li>
            );
          })}
        </ul>
      )}

      <SendShippingRequestModal
        open={modalOpen}
        item={{
          id: itemId,
          item_name: itemName,
          guest_last_name: guestLastName,
        }}
        onClose={() => setModalOpen(false)}
        onCreated={(result) => {
          if (result.guestUrl && result.requestId) {
            setGuestLinks((current) => ({
              ...current,
              [result.requestId!]: result.guestUrl,
            }));
          }
          void loadRequests();
        }}
      />
    </section>
  );
}

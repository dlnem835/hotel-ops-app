"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  buildStaffTimelineDisplay,
  formatRelativeTimestamp,
  guestLastViewedFromTimeline,
  type TimelineTone,
} from "@/app/lib/lost-found-shipping/timeline-ui";
import {
  carrierTrackingStatusLabel,
  LOST_ITEM_STATUS,
  normalizeLostItemStatus,
} from "@/app/lib/lost-found-shipping/status";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import {
  forestHoverHandlers,
  START_WORK_BUTTON,
} from "@/app/lib/oneEyrieButtons";
import SendShippingRequestModal from "./SendShippingRequestModal";
import SendLabelRequestForm from "@/app/SendLabelRequestForm";

type LostFoundShippingSectionProps = {
  itemId: number;
  itemName?: string;
  guestLastName?: string;
  itemStatus?: string | null;
  /** Manual prepaid label URL on the lost item, when present. */
  itemLabelUrl?: string | null;
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
  labelStoragePath?: string | null;
  estimatedDeliveryAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  paidAt?: string | null;
  amountPaid?: number | null;
  cancelledAt?: string | null;
  timeline?: ShippingTimelineEntry[];
};

const NOTES_COLLAPSE_CHARS = 90;

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
    return "Ready";
  }
  if (request.paymentStatus === "paid") return "Awaiting purchase";
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

function hasUsableTracking(request: ShippingRequestListItem | null): boolean {
  if (!request) return false;
  return Boolean(request.trackingNumber || request.trackingUrl);
}

function toneStyles(tone: TimelineTone): {
  border: string;
  label: string;
} {
  switch (tone) {
    case "completed":
      return { border: "#2f6b4f", label: "#BBF7D0" };
    case "current":
      return { border: "#1d4ed8", label: "#BFDBFE" };
    case "failed":
      return { border: "#7f1d1d", label: "#FECACA" };
    default:
      return { border: "#555048", label: "#9ca3af" };
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

  const eventCountLabel =
    timeline.length > 0
      ? `${timeline.length} event${timeline.length === 1 ? "" : "s"}`
      : "No events yet";

  return (
    <div className="lnf-shipping-timeline">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="lnf-shipping-timeline__toggle"
      >
        <span>Shipping Timeline</span>
        <span className="lnf-shipping-timeline__meta">
          {open ? "Hide" : `Show ${eventCountLabel}`}
        </span>
      </button>

      {open ? (
        <ol ref={listRef} className="lnf-shipping-timeline__list">
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
                className={`lnf-shipping-timeline__row${
                  flashing ? " lnf-shipping-timeline__row--flash" : ""
                }`}
                style={{ borderLeftColor: colors.border }}
              >
                <span aria-hidden="true" className="lnf-shipping-timeline__icon">
                  {row.icon}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="lnf-shipping-timeline__label-row">
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
                      <span className="lnf-shipping-timeline__pending">Pending</span>
                    ) : null}
                  </div>
                  <div
                    className="lnf-shipping-timeline__when"
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
  itemName,
  guestLastName,
  itemStatus,
  itemLabelUrl,
  onItemMayHaveChanged,
}: LostFoundShippingSectionProps) {
  const [requests, setRequests] = useState<ShippingRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
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
      const request = requests.find((row) => row.id === requestId);
      if (request && request.paymentStatus === "paid" && !guestLinks[requestId]) {
        setError(
          "The guest link cannot be re-issued after payment. Guests should keep using their original link."
        );
        return;
      }
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

  async function openGuestPage(requestId: number) {
    try {
      const request = requests.find((row) => row.id === requestId);
      if (request && request.paymentStatus === "paid" && !guestLinks[requestId]) {
        if (request.trackingUrl) {
          window.open(request.trackingUrl, "_blank", "noopener,noreferrer");
          return;
        }
        setError(
          "The guest link cannot be re-issued after payment. Guests should keep using their original link."
        );
        return;
      }
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

  async function resolveLabelUrl(
    request: ShippingRequestListItem | null
  ): Promise<string | null> {
    if (itemLabelUrl) return itemLabelUrl;
    if (!request) return null;
    if (!hasUsableLabel(request, itemLabelUrl)) return null;

    const response = await tenantFetch(
      `/api/lost-and-found/${itemId}/shipping-requests/${request.id}/label`
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Unable to open shipping label");
    }
    return String(result.url || "") || null;
  }

  async function openLabel(request: ShippingRequestListItem | null) {
    setActionBusy("label");
    try {
      const url = await resolveLabelUrl(request);
      if (!url) {
        setError("No shipping label is available.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (labelError) {
      setError(
        labelError instanceof Error
          ? labelError.message
          : "Unable to open shipping label"
      );
    } finally {
      setActionBusy(null);
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

  function openTracking(request: ShippingRequestListItem | null) {
    if (!request) return;
    if (request.trackingUrl) {
      window.open(request.trackingUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (request.id) void openGuestPage(request.id);
  }

  async function resendShippingEmail(request: ShippingRequestListItem) {
    setActionBusy("resend");
    setError(null);
    try {
      const response = await tenantFetch(
        `/api/lost-and-found/${itemId}/guest-shipping`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guestEmail: request.guestEmail,
            guestName: request.guestName || guestLastName || "",
            itemDescriptionPublic: itemName || "",
          }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        const missing =
          Array.isArray(result.missing) && result.missing.length > 0
            ? ` Missing: ${result.missing.join(", ")}.`
            : "";
        throw new Error(
          `${result.error || "Unable to resend guest shipping email."}${missing}`
        );
      }
      if (result.guestUrl && result.requestId) {
        setGuestLinks((current) => ({
          ...current,
          [Number(result.requestId)]: String(result.guestUrl),
        }));
      }
      await loadRequests();
      onItemMayHaveChanged?.();
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Unable to resend guest shipping email"
      );
    } finally {
      setActionBusy(null);
    }
  }

  let primaryAction: {
    key: string;
    label: string;
    onClick: () => void;
    busy?: boolean;
  } | null = null;

  if (workflowStatus === LOST_ITEM_STATUS.discarded) {
    primaryAction = null;
  } else if (
    workflowStatus === LOST_ITEM_STATUS.stored &&
    !activeRequest
  ) {
    primaryAction = {
      key: "send",
      label: "Send Shipping Request",
      onClick: () => setModalOpen(true),
    };
  } else if (workflowStatus === LOST_ITEM_STATUS.awaitingGuestAction) {
    if (!activeRequest) {
      primaryAction = {
        key: "send",
        label: "Send Shipping Request",
        onClick: () => setModalOpen(true),
      };
    } else {
      primaryAction = {
        key: "resend",
        label: "Resend Shipping Request",
        onClick: () => void resendShippingEmail(activeRequest),
        busy: actionBusy === "resend",
      };
    }
  } else if (workflowStatus === LOST_ITEM_STATUS.readyToShip) {
    if (hasUsableLabel(activeRequest, itemLabelUrl)) {
      primaryAction = {
        key: "print",
        label: "Print Label",
        onClick: () => void openLabel(activeRequest),
        busy: actionBusy === "label",
      };
    }
  } else if (workflowStatus === LOST_ITEM_STATUS.shipped) {
    if (hasUsableTracking(activeRequest)) {
      primaryAction = {
        key: "tracking",
        label: "View Tracking",
        onClick: () => openTracking(activeRequest),
      };
    }
  } else if (workflowStatus === LOST_ITEM_STATUS.delivered) {
    if (hasUsableTracking(activeRequest) || activeRequest?.deliveredAt) {
      primaryAction = {
        key: "delivery",
        label: "View Delivery Details",
        onClick: () => openTracking(activeRequest),
      };
    }
  }

  // Once a request exists, never show a second generic Send action.
  if (activeRequest && primaryAction?.key === "send") {
    primaryAction = null;
  }

  const showShippingCard =
    Boolean(activeRequest) || workflowStatus !== LOST_ITEM_STATUS.discarded;

  if (!showShippingCard && !loading) return null;

  const destination =
    activeRequest?.destinationCity || activeRequest?.destinationState
      ? [activeRequest.destinationCity, activeRequest.destinationState]
          .filter(Boolean)
          .join(", ")
      : "Not available";

  const lastViewed = activeRequest
    ? guestLastViewedFromTimeline(
        (activeRequest.timeline || []).map((entry) => ({
          eventType: entry.eventType,
          createdAt: entry.createdAt,
        }))
      )
    : null;

  const linkBusy = activeRequest ? linkBusyId === activeRequest.id : false;

  return (
    <section className="lnf-shipping-section" aria-label="Shipping summary">
      <div className="lnf-shipping-section__header">
        <div>
          <h3 className="lnf-shipping-section__title">Shipping Summary</h3>
          <p className="lnf-shipping-section__subtitle">
            Guest shipping, payment, label, and tracking details.
          </p>
        </div>
        {primaryAction ? (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={Boolean(primaryAction.busy)}
            style={{
              ...START_WORK_BUTTON,
              height: "34px",
              padding: "0 12px",
              fontSize: "12px",
              opacity: primaryAction.busy ? 0.7 : 1,
            }}
            className="one-eyrie-btn one-eyrie-btn--forest one-eyrie-btn--sm"
            {...forestHoverHandlers()}
          >
            {primaryAction.busy ? "Working…" : primaryAction.label}
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="lnf-shipping-section__empty">Loading shipping details…</p>
      ) : error ? (
        <p className="lnf-shipping-section__error">{error}</p>
      ) : !activeRequest ? (
        <p className="lnf-shipping-section__empty">
          No shipping request yet. Use Send Shipping Request when the guest is
          ready to arrange return shipping.
        </p>
      ) : (
        <div className="lnf-shipping-summary">
          <div className="lnf-shipping-summary__status-row">
            <span className="lnf-shipping-summary__workflow">
              {workflowStatus}
            </span>
          </div>

          {(activeRequest.returnedToSender ||
            activeRequest.shippingExceptionCode ||
            activeRequest.shippingExceptionMessage) && (
            <div
              role="alert"
              className={`lnf-shipping-summary__alert${
                activeRequest.returnedToSender
                  ? " lnf-shipping-summary__alert--danger"
                  : " lnf-shipping-summary__alert--warn"
              }`}
            >
              {activeRequest.returnedToSender
                ? "Returned to sender"
                : "Shipping exception"}
              {activeRequest.shippingExceptionMessage
                ? `: ${activeRequest.shippingExceptionMessage}`
                : ""}
            </div>
          )}

          <dl className="lnf-shipping-summary__grid">
            <SummaryField
              label="Guest name"
              value={activeRequest.guestName || "Not available"}
            />
            <SummaryField
              label="Guest email"
              value={activeRequest.guestEmail || "Not available"}
            />
            <SummaryField
              label="Guest viewed"
              value={
                lastViewed
                  ? `${formatRelativeTimestamp(lastViewed)} · ${formatLocalDate(
                      lastViewed
                    )}`
                  : "Not viewed yet"
              }
            />
            <SummaryField
              label="Carrier"
              value={activeRequest.selectedCarrier || "Not available"}
            />
            <SummaryField
              label="Service"
              value={activeRequest.selectedService || "Not available"}
            />
            <SummaryField label="Destination" value={destination} />
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
              label="Payment"
              value={paymentLabel(activeRequest.paymentStatus)}
            />
            <SummaryField
              label="Label"
              value={labelStatusLabel(activeRequest)}
            />
            <SummaryField
              label="Printed"
              value={
                activeRequest.labelPrintedAt
                  ? formatLocalDate(activeRequest.labelPrintedAt)
                  : "Not printed"
              }
            />
            <SummaryField
              label="Carrier status"
              value={carrierTrackingStatusLabel(
                activeRequest.carrierTrackingStatus
              )}
            />
            <SummaryField
              label="Shipping cost"
              value={formatMoney(
                activeRequest.amountPaid ?? activeRequest.totalAmount,
                activeRequest.currency
              )}
            />
            <SummaryField
              label="Shipped"
              value={formatLocalDate(activeRequest.shippedAt)}
            />
            <SummaryField
              label="Estimated delivery"
              value={formatLocalDate(activeRequest.estimatedDeliveryAt)}
            />
            <SummaryField
              label="Delivered"
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
              onClick={() => void openGuestPage(activeRequest.id)}
            >
              Open Guest Page
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
            {hasUsableLabel(activeRequest, itemLabelUrl) ? (
              <button
                type="button"
                style={linkButtonStyle()}
                disabled={actionBusy === "label"}
                onClick={() => void openLabel(activeRequest)}
              >
                Download Label
              </button>
            ) : null}
            {hasUsableLabel(activeRequest, itemLabelUrl) &&
            !activeRequest.labelPrintedAt ? (
              <button
                type="button"
                style={linkButtonStyle()}
                disabled={actionBusy === "printed"}
                onClick={() => void markPrinted(activeRequest)}
              >
                {actionBusy === "printed" ? "Saving…" : "Mark Label Printed"}
              </button>
            ) : null}
            {hasUsableTracking(activeRequest) && activeRequest.trackingUrl ? (
              <button
                type="button"
                style={linkButtonStyle()}
                onClick={() => openTracking(activeRequest)}
              >
                View Carrier Tracking
              </button>
            ) : null}
          </div>

          <ShippingTimelinePanel timeline={activeRequest.timeline || []} />
        </div>
      )}

      <div className="lnf-manual-label-fallback">
        <h4 className="lnf-manual-label-fallback__title">Manual Label Upload</h4>
        <p className="lnf-manual-label-fallback__copy">
          Secondary option for prepaid labels. Guests create their own carrier
          label and upload the PDF. Prefer Guest Shipping above when automated
          shipping is enabled.
        </p>
        <SendLabelRequestForm itemId={itemId} />
      </div>

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
          onItemMayHaveChanged?.();
        }}
      />
    </section>
  );
}

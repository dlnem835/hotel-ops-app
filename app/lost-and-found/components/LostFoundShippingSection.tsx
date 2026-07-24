"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  buildStaffTimelineDisplay,
  formatRelativeTimestamp,
  type TimelineTone,
} from "@/app/lib/lost-found-shipping/timeline-ui";
import type { ShippingCurrentStep } from "@/app/lib/lost-found-shipping/status";
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
  const rows = useMemo(
    () => buildStaffTimelineDisplay({ events: timeline }),
    [timeline]
  );

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
          style={{
            listStyle: "none",
            margin: "10px 0 0",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {rows.map((row) => {
            const colors = toneStyles(row.tone);
            const exact =
              row.createdAt && !Number.isNaN(new Date(row.createdAt).getTime())
                ? new Date(row.createdAt).toLocaleString()
                : null;
            const pending = row.kind === "milestone" || !row.createdAt;
            return (
              <li
                key={row.id}
                style={{
                  display: "flex",
                  gap: "10px",
                  borderLeft: `3px solid ${colors.border}`,
                  paddingLeft: "10px",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "8px",
                    height: "8px",
                    marginTop: "5px",
                    borderRadius: "999px",
                    background: colors.dot,
                    flexShrink: 0,
                  }}
                />
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

export default function LostFoundShippingSection({
  itemId,
  itemName,
  guestLastName,
}: LostFoundShippingSectionProps) {
  const [requests, setRequests] = useState<ShippingRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [guestLinkNote, setGuestLinkNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await tenantFetch(
        `/api/lost-and-found/${itemId}/shipping-requests`
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to load shipping requests");
      }
      setRequests((result.requests || []) as ShippingRequestListItem[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load shipping requests"
      );
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function copyGuestLink() {
    if (!guestLinkNote) return;
    try {
      await navigator.clipboard.writeText(guestLinkNote);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
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

      {guestLinkNote ? (
        <div
          style={{
            marginBottom: "12px",
            padding: "10px 12px",
            borderRadius: "10px",
            border: `1px solid ${ONE_EYRIE.gold}`,
            background: ONE_EYRIE.surfaceInset,
          }}
        >
          <div
            style={{
              color: ONE_EYRIE.gold,
              fontSize: "12px",
              fontWeight: 800,
              marginBottom: "6px",
            }}
          >
            Phase 1–2: copy guest link (email in Phase 3)
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <code
              style={{
                flex: 1,
                minWidth: "0",
                fontSize: "11px",
                color: ONE_EYRIE.textRow,
                wordBreak: "break-all",
              }}
            >
              {guestLinkNote}
            </code>
            <button
              type="button"
              onClick={() => void copyGuestLink()}
              style={{
                border: `1px solid ${ONE_EYRIE.gold}`,
                background: "transparent",
                color: ONE_EYRIE.gold,
                borderRadius: "8px",
                height: "30px",
                padding: "0 10px",
                fontWeight: 800,
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

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
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>Guest: </span>
                    {request.guestEmail || "No guest email"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Destination:{" "}
                    </span>
                    {destination || "Not provided yet"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Selected service:{" "}
                    </span>
                    {[request.selectedCarrier, request.selectedService]
                      .filter(Boolean)
                      .join(" · ") || "Not selected yet"}
                  </div>
                  <div style={{ color: ONE_EYRIE.textRow }}>
                    <span style={{ color: ONE_EYRIE.textSubtle }}>
                      Shipping amount:{" "}
                    </span>
                    {formatMoney(request.totalAmount, request.currency)}
                  </div>
                </div>

                {request.trackingNumber ? (
                  <div style={{ marginTop: "6px", fontSize: "12px" }}>
                    {request.trackingUrl ? (
                      <a
                        href={request.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: ONE_EYRIE.gold }}
                      >
                        Track {request.trackingNumber}
                      </a>
                    ) : (
                      <span style={{ color: ONE_EYRIE.textRow }}>
                        Tracking: {request.trackingNumber}
                      </span>
                    )}
                  </div>
                ) : null}

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
          if (result.guestUrl) setGuestLinkNote(result.guestUrl);
          void loadRequests();
        }}
      />
    </section>
  );
}

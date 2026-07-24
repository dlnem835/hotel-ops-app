"use client";

import { useCallback, useEffect, useState } from "react";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
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
  trackingNumber: string | null;
  trackingUrl: string | null;
  badge: ShippingUiBadge | string;
};

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
            Phase 1: copy guest link (email in Phase 3)
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
          {requests.map((request) => (
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
                  marginBottom: "6px",
                }}
              >
                <LostFoundShippingBadge badge={String(request.badge)} />
                <span style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px" }}>
                  {request.createdAt
                    ? new Date(request.createdAt).toLocaleString()
                    : "—"}
                </span>
              </div>
              <div style={{ color: ONE_EYRIE.textRow, fontSize: "13px" }}>
                {request.guestEmail || "No guest email"}
              </div>
              <div
                style={{
                  marginTop: "6px",
                  color: ONE_EYRIE.textSubtle,
                  fontSize: "12px",
                  lineHeight: 1.45,
                }}
              >
                Payment: {request.paymentStatus} · Fulfillment:{" "}
                {request.fulfillmentStatus} · Shipment: {request.shipmentStatus}
              </div>
              <div
                style={{
                  marginTop: "4px",
                  color: ONE_EYRIE.textSubtle,
                  fontSize: "12px",
                }}
              >
                {[request.selectedCarrier, request.selectedService]
                  .filter(Boolean)
                  .join(" · ") || "No carrier selected"}{" "}
                · {formatMoney(request.totalAmount, request.currency)}
              </div>
              {request.trackingNumber ? (
                <div style={{ marginTop: "4px", fontSize: "12px" }}>
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
            </li>
          ))}
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

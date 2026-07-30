"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { tenantFetch, readTenantJson } from "@/app/lib/tenant/tenant-fetch";
import {
  LOST_ITEM_STATUS,
  normalizeLostItemStatus,
} from "@/app/lib/lost-found-shipping/status";

type LostFoundItemActionsMenuProps = {
  item: {
    id: number | string;
    item_name?: string | null;
    guest_last_name?: string | null;
    status?: string | null;
    label_url?: string | null;
    comments?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendShippingRequest: () => void;
  onResendShippingRequest: (details: {
    guestEmail: string;
    guestName: string;
  }) => void;
  onEditComment: () => void;
  onDeleted: () => void;
  onRefresh: () => void;
  onError: (message: string) => void;
  onToast?: (message: string) => void;
  /** Admin Portal entitlement — required to show Delete Item. */
  canDelete?: boolean;
};

type ShippingRequestRow = {
  id: number;
  guestEmail?: string;
  guestName?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  cancelledAt?: string | null;
  labelStoragePath?: string | null;
  trackingUrl?: string | null;
  errorMessage?: string | null;
};

export default function LostFoundItemActionsMenu({
  item,
  open,
  onOpenChange,
  onSendShippingRequest,
  onResendShippingRequest,
  onEditComment,
  onDeleted,
  onRefresh,
  onError,
  onToast,
  canDelete = false,
}: LostFoundItemActionsMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);

  const status =
    normalizeLostItemStatus(item.status) ||
    String(item.status || LOST_ITEM_STATUS.stored);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  async function loadActiveRequest(): Promise<ShippingRequestRow | null> {
    const response = await tenantFetch(
      `/api/lost-and-found/${item.id}/shipping-requests`
    );
    const result = await readTenantJson<{
      error?: string;
      requests?: ShippingRequestRow[];
    }>(response);
    if (!response.ok) {
      throw new Error(result.error || "Unable to load shipping request");
    }
    const requests = result.requests || [];
    return requests.find((row) => !row.cancelledAt) || requests[0] || null;
  }

  async function ensureGuestLink(requestId: number): Promise<string> {
    const response = await tenantFetch(
      `/api/lost-and-found/${item.id}/shipping-requests/${requestId}/guest-link`,
      { method: "POST" }
    );
    const result = await readTenantJson<{ error?: string; guestUrl?: string }>(
      response
    );
    if (!response.ok) {
      throw new Error(result.error || "Unable to issue guest link");
    }
    const url = String(result.guestUrl || "");
    if (!url) throw new Error("Guest link missing from response");
    return url;
  }

  async function withBusy(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      onOpenChange(false);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const showSend = status === LOST_ITEM_STATUS.stored;
  const showResend = status === LOST_ITEM_STATUS.awaitingGuestAction;
  const showGuestLinkActions =
    status === LOST_ITEM_STATUS.awaitingGuestAction ||
    status === LOST_ITEM_STATUS.readyToShip ||
    status === LOST_ITEM_STATUS.shipped ||
    status === LOST_ITEM_STATUS.delivered;
  const showPrintLabel =
    status === LOST_ITEM_STATUS.readyToShip || Boolean(item.label_url);

  return (
    <div className="lnf-row-actions" ref={rootRef}>
      <button
        type="button"
        className="one-eyrie-icon-btn lnf-row-actions__trigger"
        aria-label="Item actions"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <MoreVertical size={18} />
      </button>

      {open ? (
        <div className="lnf-row-actions__menu" role="menu">
          {showSend ? (
            <button
              type="button"
              role="menuitem"
              className="lnf-row-actions__item"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                onSendShippingRequest();
              }}
            >
              Send Shipping Request
            </button>
          ) : null}

          {showResend ? (
            <button
              type="button"
              role="menuitem"
              className="lnf-row-actions__item"
              disabled={busy}
              onClick={() =>
                void withBusy(async () => {
                  const request = await loadActiveRequest();
                  onResendShippingRequest({
                    guestEmail: String(request?.guestEmail || "").trim(),
                    guestName: String(
                      request?.guestName || item.guest_last_name || ""
                    ).trim(),
                  });
                })
              }
            >
              Resend Shipping Request
            </button>
          ) : null}

          {showGuestLinkActions ? (
            <button
              type="button"
              role="menuitem"
              className="lnf-row-actions__item"
              disabled={busy}
              onClick={() =>
                void withBusy(async () => {
                  const request = await loadActiveRequest();
                  if (!request) {
                    throw new Error("No shipping request found for this item.");
                  }
                  if (request.paymentStatus === "paid") {
                    throw new Error(
                      "Guest link cannot be re-issued after payment."
                    );
                  }
                  const url = await ensureGuestLink(request.id);
                  await navigator.clipboard.writeText(url);
                  onToast?.("Guest link copied.");
                })
              }
            >
              Copy Guest Link
            </button>
          ) : null}

          <button
            type="button"
            role="menuitem"
            className="lnf-row-actions__item"
            disabled={busy}
            onClick={() => {
              onOpenChange(false);
              onEditComment();
            }}
          >
            {item.comments?.trim() ? "Edit Comment" : "Add Comment"}
          </button>

          {showResend ? (
            <button
              type="button"
              role="menuitem"
              className="lnf-row-actions__item"
              disabled={busy}
              onClick={() =>
                void withBusy(async () => {
                  const request = await loadActiveRequest();
                  if (!request?.id) {
                    throw new Error("No shipping request found.");
                  }
                  if (String(request.paymentStatus) !== "paid") {
                    throw new Error(
                      "Retry Label Creation is only available after payment succeeds."
                    );
                  }
                  if (
                    String(request.fulfillmentStatus) === "label_ready" ||
                    request.labelStoragePath
                  ) {
                    throw new Error("A shipping label is already available.");
                  }
                  const response = await tenantFetch(
                    `/api/lost-and-found/${item.id}/shipping-requests/${request.id}/retry-label`,
                    { method: "POST" }
                  );
                  const result = await readTenantJson<{
                    error?: string;
                    message?: string;
                    trackingNumber?: string | null;
                  }>(response);
                  if (!response.ok) {
                    throw new Error(
                      result.error || "Unable to retry label creation"
                    );
                  }
                  onToast?.(
                    result.trackingNumber
                      ? `Label created. Tracking ${result.trackingNumber}.`
                      : result.message || "Label retry completed."
                  );
                  onRefresh();
                })
              }
            >
              Retry Label Creation
            </button>
          ) : null}

          {showPrintLabel ? (
            <button
              type="button"
              role="menuitem"
              className="lnf-row-actions__item"
              disabled={busy}
              onClick={() =>
                void withBusy(async () => {
                  if (item.label_url) {
                    window.open(
                      String(item.label_url),
                      "_blank",
                      "noopener,noreferrer"
                    );
                    return;
                  }
                  const request = await loadActiveRequest();
                  if (!request?.id) {
                    throw new Error("No shipping label is available.");
                  }
                  const response = await tenantFetch(
                    `/api/lost-and-found/${item.id}/shipping-requests/${request.id}/label`
                  );
                  const result = await readTenantJson<{
                    error?: string;
                    url?: string;
                  }>(response);
                  if (!response.ok || !result.url) {
                    throw new Error(
                      result.error || "Unable to open shipping label"
                    );
                  }
                  window.open(
                    String(result.url),
                    "_blank",
                    "noopener,noreferrer"
                  );
                })
              }
            >
              Print Shipping Label
            </button>
          ) : null}

          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              className="lnf-row-actions__item lnf-row-actions__item--danger"
              disabled={busy}
              onClick={() => {
                onOpenChange(false);
                if (!confirm("Delete this item?")) return;
                void (async () => {
                  try {
                    const response = await tenantFetch(
                      `/api/lost-and-found/${item.id}`,
                      { method: "DELETE" }
                    );
                    if (!response.ok) {
                      const result = await response.json().catch(() => ({}));
                      throw new Error(
                        (result as { error?: string }).error ||
                          "Unable to delete item"
                      );
                    }
                    onDeleted();
                  } catch (error) {
                    onError(
                      error instanceof Error
                        ? error.message
                        : "Unable to delete item"
                    );
                  }
                })();
              }}
            >
              Delete Item
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

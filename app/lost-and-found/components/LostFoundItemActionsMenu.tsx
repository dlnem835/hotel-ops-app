"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type MenuCoords = {
  top: number;
  left: number;
};

const MENU_GAP = 4;
const VIEWPORT_PAD = 8;
const MENU_MIN_WIDTH = 210;

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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [mounted, setMounted] = useState(false);

  const status =
    normalizeLostItemStatus(item.status) ||
    String(item.status || LOST_ITEM_STATUS.stored);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menu = menuRef.current;
      const menuHeight = menu?.offsetHeight || 220;
      const menuWidth = Math.max(menu?.offsetWidth || 0, MENU_MIN_WIDTH);
      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
      const spaceAbove = rect.top - VIEWPORT_PAD;
      const placeAbove =
        spaceBelow < menuHeight + MENU_GAP && spaceAbove > spaceBelow;

      let top = placeAbove
        ? rect.top - menuHeight - MENU_GAP
        : rect.bottom + MENU_GAP;
      let left = rect.right - menuWidth;

      left = Math.min(
        Math.max(VIEWPORT_PAD, left),
        window.innerWidth - menuWidth - VIEWPORT_PAD
      );
      top = Math.min(
        Math.max(VIEWPORT_PAD, top),
        window.innerHeight - menuHeight - VIEWPORT_PAD
      );

      setCoords({ top, left });
    }

    updatePosition();
    // Remeasure after paint once menu DOM is available.
    const raf = window.requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, busy, canDelete, status, item.comments, item.label_url]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onOpenChange(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        triggerRef.current?.focus();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const menu = menuRef.current;
      if (!menu) return;
      const items = Array.from(
        menu.querySelectorAll<HTMLButtonElement>(
          '[role="menuitem"]:not(:disabled)'
        )
      );
      if (items.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const index = items.findIndex((el) => el === active);
      event.preventDefault();

      if (event.key === "ArrowDown") {
        const next = index < 0 ? 0 : (index + 1) % items.length;
        items[next]?.focus();
      } else {
        const prev = index <= 0 ? items.length - 1 : index - 1;
        items[prev]?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>(
          '[role="menuitem"]:not(:disabled)'
        )
        ?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

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
      triggerRef.current?.focus();
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

  const menu =
    open && mounted
      ? createPortal(
          <div
            ref={menuRef}
            className="lnf-row-actions__menu lnf-row-actions__menu--portal"
            role="menu"
            aria-label="Item actions"
            style={
              coords
                ? {
                    top: coords.top,
                    left: coords.left,
                    visibility: "visible" as const,
                  }
                : { visibility: "hidden" as const, top: 0, left: 0 }
            }
          >
            {showSend ? (
              <button
                type="button"
                role="menuitem"
                className="lnf-row-actions__item"
                disabled={busy}
                onClick={() => {
                  onOpenChange(false);
                  triggerRef.current?.focus();
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
                      throw new Error(
                        "No shipping request found for this item."
                      );
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
                triggerRef.current?.focus();
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
                  triggerRef.current?.focus();
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
          </div>,
          document.body
        )
      : null;

  return (
    <div className="lnf-row-actions">
      <button
        ref={triggerRef}
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
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
      >
        <MoreVertical size={18} />
      </button>
      {menu}
    </div>
  );
}

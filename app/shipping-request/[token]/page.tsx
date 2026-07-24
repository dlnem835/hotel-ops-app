"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import type { GuestShippingRequestView } from "@/app/lib/lost-found-shipping/shipping-requests";
import type { ShippingRate } from "@/app/lib/shipping/types";
import "../shipping-request.css";

type AddressForm = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal: string;
  country: string;
  phone: string;
  email: string;
};

const emptyAddress: AddressForm = {
  name: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal: "",
  country: "US",
  phone: "",
  email: "",
};

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

export default function ShippingRequestGuestPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token || "");

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<GuestShippingRequestView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [address, setAddress] = useState<AddressForm>(emptyAddress);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "info">("info");

  const loadRequest = useCallback(async () => {
    if (!token) {
      setLoadError("Missing shipping link.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/shipping-request/${encodeURIComponent(token)}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to load shipping request");
      }
      const nextView = result.request as GuestShippingRequestView;
      setView(nextView);
      setAddress((current) => ({
        ...current,
        name: nextView.guestName || current.name,
        email: nextView.guestEmail || current.email,
      }));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to load shipping request"
      );
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  async function postAction(body: Record<string, unknown>) {
    const response = await fetch(`/api/shipping-request/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Request failed");
    }
    return result;
  }

  async function fetchRates() {
    const result = await postAction({ action: "get_rates" });
    setRates((result.rates || []) as ShippingRate[]);
  }

  useEffect(() => {
    if (!view || view.state !== "awaiting_payment") return;
    let mounted = true;
    setBusy(true);
    void fetchRates()
      .catch((error) => {
        if (!mounted) return;
        setMessageTone("error");
        setMessage(
          error instanceof Error ? error.message : "Unable to load shipping rates"
        );
      })
      .finally(() => {
        if (mounted) setBusy(false);
      });
    return () => {
      mounted = false;
    };
    // Intentionally only when entering awaiting_payment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.state]);

  async function handleValidateAddress() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await postAction({
        action: "validate_address",
        ...address,
      });
      if (result.validation && result.validation.isValid === false) {
        setMessageTone("error");
        setMessage(
          (result.validation.messages || []).join(" ") ||
            "Address could not be validated."
        );
        return;
      }

      const suggested = result.validation?.suggestedAddress;
      if (suggested) {
        setAddress({
          name: String(suggested.name || ""),
          line1: String(suggested.line1 || ""),
          line2: String(suggested.line2 || ""),
          city: String(suggested.city || ""),
          state: String(suggested.state || ""),
          postal: String(suggested.postal || ""),
          country: String(suggested.country || "US"),
          phone: String(suggested.phone || ""),
          email: String(suggested.email || address.email),
        });
      }

      await fetchRates();
      await loadRequest();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to validate address");
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectRate(providerRateId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await postAction({
        action: "select_rate",
        providerRateId,
      });
      setMessageTone("info");
      setMessage(
        String(
          result.message ||
            "Rate selection saved. Stripe Checkout will be connected in Checkpoint C."
        )
      );
      await loadRequest();
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to select rate");
    } finally {
      setBusy(false);
    }
  }

  function renderStatusBody() {
    if (loading) {
      return <p className="shipping-request-copy">Loading your shipping request…</p>;
    }

    if (loadError || !view) {
      return (
        <div className="shipping-request-message shipping-request-message--error">
          {loadError || "This shipping request is unavailable."}
        </div>
      );
    }

    if (view.state === "unavailable") {
      return (
        <div className="shipping-request-status-card">
          <h3>Request unavailable</h3>
          <p>This shipping link is no longer available. Please contact the hotel.</p>
        </div>
      );
    }

    if (view.state === "expired") {
      return (
        <div className="shipping-request-status-card">
          <h3>Link expired</h3>
          <p>
            This shipping request has expired. Please contact the hotel for a new
            link.
          </p>
        </div>
      );
    }

    if (view.state === "payment_processing") {
      return (
        <div className="shipping-request-status-card">
          <h3>Payment received</h3>
          <p>We are preparing your shipping label. This usually takes a moment.</p>
        </div>
      );
    }

    if (view.state === "label_created") {
      return (
        <div className="shipping-request-status-card">
          <h3>Label ready</h3>
          <p>
            Your shipping label is ready. The hotel will ship your item shortly
            {view.selectedCarrier ? ` via ${view.selectedCarrier}` : ""}.
          </p>
        </div>
      );
    }

    if (view.state === "in_transit") {
      return (
        <div className="shipping-request-status-card">
          <h3>In transit</h3>
          <p>Your item is on the way.</p>
          {view.trackingNumber ? (
            <p style={{ marginTop: "10px" }}>
              {view.trackingUrl ? (
                <a href={view.trackingUrl} target="_blank" rel="noreferrer">
                  Track {view.trackingNumber}
                </a>
              ) : (
                <>Tracking: {view.trackingNumber}</>
              )}
            </p>
          ) : null}
        </div>
      );
    }

    if (view.state === "delivered") {
      return (
        <div className="shipping-request-status-card">
          <h3>Delivered</h3>
          <p>Your item has been delivered. Thank you.</p>
        </div>
      );
    }

    const showAddressForm = view.state === "awaiting_guest";
    const showRates =
      view.state === "awaiting_payment" || (showAddressForm && rates.length > 0);

    return (
      <>
        <p className="shipping-request-property">{view.propertyName}</p>
        <h1 className="shipping-request-title">We found your item</h1>
        <p className="shipping-request-copy">
          Confirm your shipping address and choose a delivery option to continue.
        </p>
        <div className="shipping-request-item">{view.itemDescription}</div>

        {showAddressForm ? (
          <form
            className="shipping-request-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleValidateAddress();
            }}
          >
            <label className="shipping-request-field">
              <span>Full name</span>
              <input
                required
                value={address.name}
                onChange={(event) =>
                  setAddress((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="shipping-request-field">
              <span>Address line 1</span>
              <input
                required
                value={address.line1}
                onChange={(event) =>
                  setAddress((current) => ({ ...current, line1: event.target.value }))
                }
              />
            </label>
            <label className="shipping-request-field">
              <span>Address line 2</span>
              <input
                value={address.line2}
                onChange={(event) =>
                  setAddress((current) => ({ ...current, line2: event.target.value }))
                }
              />
            </label>
            <div className="shipping-request-row">
              <label className="shipping-request-field">
                <span>City</span>
                <input
                  required
                  value={address.city}
                  onChange={(event) =>
                    setAddress((current) => ({ ...current, city: event.target.value }))
                  }
                />
              </label>
              <label className="shipping-request-field">
                <span>State</span>
                <input
                  required
                  value={address.state}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      state: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="shipping-request-row">
              <label className="shipping-request-field">
                <span>Postal code</span>
                <input
                  required
                  value={address.postal}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      postal: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="shipping-request-field">
                <span>Country</span>
                <input
                  required
                  value={address.country}
                  onChange={(event) =>
                    setAddress((current) => ({
                      ...current,
                      country: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="shipping-request-field">
              <span>Phone</span>
              <input
                value={address.phone}
                onChange={(event) =>
                  setAddress((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </label>
            <label className="shipping-request-field">
              <span>Email</span>
              <input
                type="email"
                required
                value={address.email}
                onChange={(event) =>
                  setAddress((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <div className="shipping-request-actions">
              <button
                type="submit"
                className="shipping-request-btn shipping-request-btn--primary"
                disabled={busy}
              >
                {busy ? "Working…" : "Continue to rates"}
              </button>
            </div>
          </form>
        ) : null}

        {showRates ? (
          <div style={{ marginTop: showAddressForm ? "22px" : 0 }}>
            <h2 className="shipping-request-title" style={{ fontSize: "18px" }}>
              Choose a shipping option
            </h2>
            {busy && rates.length === 0 ? (
              <p className="shipping-request-copy">Loading rates…</p>
            ) : rates.length === 0 ? (
              <p className="shipping-request-copy">No rates available yet.</p>
            ) : (
              <div className="shipping-request-rates">
                {rates.map((rate) => (
                  <button
                    key={rate.providerRateId}
                    type="button"
                    className="shipping-request-rate"
                    disabled={busy}
                    onClick={() => void handleSelectRate(rate.providerRateId)}
                  >
                    <div className="shipping-request-rate__title">
                      {rate.carrier} · {rate.service}
                    </div>
                    <div className="shipping-request-rate__meta">
                      {rate.estimatedDeliveryLabel ||
                        (rate.estimatedDaysMin != null
                          ? `${rate.estimatedDaysMin}${
                              rate.estimatedDaysMax != null
                                ? `–${rate.estimatedDaysMax}`
                                : ""
                            } days`
                          : "Delivery estimate unavailable")}
                    </div>
                    <div className="shipping-request-rate__amount">
                      {formatMoney(rate.amount, rate.currency)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {message ? (
          <div
            className={`shipping-request-message shipping-request-message--${messageTone}`}
          >
            {message}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <main className="shipping-request-page">
      <div className="shipping-request-shell">
        <div className="shipping-request-brand">
          <OneEyrieWordmark className="one-eyrie-wordmark--login" />
          <p className="shipping-request-brand__eyebrow">Lost &amp; Found Shipping</p>
        </div>
        <div className="shipping-request-body">{renderStatusBody()}</div>
      </div>
    </main>
  );
}

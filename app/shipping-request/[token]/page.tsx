"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { GuestShippingRequestView } from "@/app/lib/lost-found-shipping/shipping-requests";
import {
  GUEST_PROGRESS_STEPS,
  guestProgressIndex,
} from "@/app/lib/lost-found-shipping/timeline-ui";
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

function formatFoundDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function rateBadges(rate: ShippingRate): string[] {
  const labels: string[] = [];
  const badges = rate.badges || [];
  if (badges.includes("best_value") || rate.highlight === "best_value") {
    labels.push("Best Value");
  }
  if (badges.includes("fastest") || rate.highlight === "fastest") {
    labels.push("Fastest");
  }
  if (
    !labels.includes("Best Value") &&
    (badges.includes("lowest_price") || rate.highlight === "cheapest")
  ) {
    labels.push("Best Value");
  }
  return labels;
}

function propertyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "H";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function formatPackageSummary(view: GuestShippingRequestView): string | null {
  const pkg = view.package;
  const hasDims =
    pkg.lengthIn != null &&
    pkg.widthIn != null &&
    pkg.heightIn != null &&
    Number.isFinite(pkg.lengthIn) &&
    Number.isFinite(pkg.widthIn) &&
    Number.isFinite(pkg.heightIn);
  const dimLabel = hasDims
    ? `${pkg.lengthIn}" × ${pkg.widthIn}" × ${pkg.heightIn}"`
    : null;
  const weight = weightLabel(pkg.weightOz);
  if (!dimLabel && !weight) return null;
  return [dimLabel, weight].filter(Boolean).join(" · ");
}

function weightLabel(weightOz: number | null): string | null {
  if (weightOz == null || !Number.isFinite(weightOz)) return null;
  if (weightOz >= 16) {
    const pounds = Math.floor(weightOz / 16);
    const ounces = Math.round(weightOz % 16);
    return ounces > 0 ? `${pounds} lb ${ounces} oz` : `${pounds} lb`;
  }
  return `${weightOz} oz`;
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
  const [ratesLoading, setRatesLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "info" | "success">(
    "info"
  );
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [rateExpiresAt, setRateExpiresAt] = useState<string | null>(null);
  const [ratesExpired, setRatesExpired] = useState(false);

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
      setSelectedRateId(nextView.selectedProviderRateId);
      setRateExpiresAt(nextView.rateExpiresAt);
      setLogoFailed(false);
      setAddress((current) => {
        const recipient = nextView.recipientAddress;
        if (recipient?.line1) {
          return {
            name: recipient.name || nextView.guestName || "",
            line1: recipient.line1 || "",
            line2: recipient.line2 || "",
            city: recipient.city || "",
            state: recipient.state || "",
            postal: recipient.postal || "",
            country: recipient.country || "US",
            phone: recipient.phone || "",
            email: recipient.email || nextView.guestEmail || "",
          };
        }
        return {
          ...current,
          name: nextView.guestName || current.name,
          email: nextView.guestEmail || current.email,
        };
      });
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
    setRatesLoading(true);
    try {
      const result = await postAction({ action: "get_rates" });
      setRates((result.rates || []) as ShippingRate[]);
      setRateExpiresAt(
        result.rateExpiresAt ? String(result.rateExpiresAt) : null
      );
      setRatesExpired(false);
    } finally {
      setRatesLoading(false);
    }
  }

  useEffect(() => {
    if (ratesExpired || ratesLoading || busy) return;
    if (rates.length !== 1) return;
    const only = rates[0];
    if (!only?.providerRateId) return;
    if (selectedRateId === only.providerRateId) return;
    void handleSelectRate(only.providerRateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates, ratesExpired, ratesLoading, selectedRateId, busy]);

  useEffect(() => {
    if (!rateExpiresAt) {
      setRatesExpired(false);
      return;
    }
    const expiresMs = new Date(rateExpiresAt).getTime();
    if (Number.isNaN(expiresMs)) return;

    function checkExpired() {
      setRatesExpired(Date.now() >= expiresMs);
    }

    checkExpired();
    const timer = window.setInterval(checkExpired, 15000);
    return () => window.clearInterval(timer);
  }, [rateExpiresAt]);

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

  async function handleRefreshRates() {
    setBusy(true);
    setMessage(null);
    try {
      await fetchRates();
      setSelectedRateId(null);
      setMessageTone("success");
      setMessage("Shipping rates refreshed. Please select an option again.");
      await loadRequest();
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to refresh shipping rates. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

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
            "We could not validate that address. Please check it and try again."
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
        setMessageTone("success");
        setMessage("Address verified. Suggested carrier corrections were applied.");
      } else {
        setMessageTone("success");
        setMessage("Address verified. Choose a shipping option below.");
      }

      await fetchRates();
      await loadRequest();
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to validate address. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectRate(providerRateId: string) {
    if (ratesExpired) {
      setMessageTone("error");
      setMessage(
        "These shipping rates have expired. Refresh rates to continue."
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await postAction({
        action: "select_rate",
        providerRateId,
      });
      setSelectedRateId(providerRateId);
      setMessageTone("success");
      setMessage(
        String(
          result.message ||
            "Shipping option saved. You can continue to secure payment next."
        )
      );
      await loadRequest();
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "Unable to select that shipping option. Please try again.";
      if (/expired/i.test(text)) {
        setRatesExpired(true);
        setMessageTone("error");
        setMessage(
          "These shipping rates have expired. Refresh rates to choose a new option."
        );
      } else {
        setMessageTone("error");
        setMessage(text);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleEditAddress() {
    setBusy(true);
    setMessage(null);
    try {
      await postAction({ action: "edit_address" });
      setRates([]);
      setSelectedRateId(null);
      setMessageTone("info");
      setMessage("Update your shipping address, then continue to rates.");
      await loadRequest();
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to return to address editing."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleContinueToPayment() {
    setMessageTone("info");
    setMessage(
      "Your shipping option is saved. Secure Stripe Checkout will connect here in Checkpoint C — no payment has been collected."
    );
  }

  const progressActive = view ? guestProgressIndex(view.state) : 0;
  const packageSummary = view ? formatPackageSummary(view) : null;
  const foundDateLabel = view ? formatFoundDate(view.foundDate) : null;

  const selectedRate = useMemo(() => {
    if (!selectedRateId) return null;
    return rates.find((rate) => rate.providerRateId === selectedRateId) || null;
  }, [rates, selectedRateId]);

  function renderProgress() {
    if (!view || view.state === "unavailable" || view.state === "expired") {
      return null;
    }
    return (
      <ol className="shipping-request-progress" aria-label="Shipping progress">
        {GUEST_PROGRESS_STEPS.map((step, index) => {
          const done = index < progressActive;
          const current = index === progressActive;
          return (
            <li
              key={step.key}
              className={`shipping-request-progress__step${
                done ? " is-done" : ""
              }${current ? " is-current" : ""}`}
            >
              <span className="shipping-request-progress__dot" aria-hidden="true" />
              <span className="shipping-request-progress__label">{step.label}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  function renderItemCard() {
    if (!view) return null;
    return (
      <div className="shipping-request-item-card">
        {view.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={view.photoUrl}
            alt={view.itemName || "Lost item"}
            className="shipping-request-item-card__photo"
          />
        ) : null}
        <div className="shipping-request-item-card__body">
          <div className="shipping-request-item-card__eyebrow">Item details</div>
          <h2 className="shipping-request-item-card__title">
            {view.itemName || "Your item"}
          </h2>
          {view.itemDescription && view.itemDescription !== view.itemName ? (
            <p className="shipping-request-item-card__description">
              {view.itemDescription}
            </p>
          ) : null}
          <dl className="shipping-request-item-card__meta">
            {view.roomNumber ? (
              <div>
                <dt>Room / location</dt>
                <dd>{view.roomNumber}</dd>
              </div>
            ) : null}
            {foundDateLabel ? (
              <div>
                <dt>Found</dt>
                <dd>{foundDateLabel}</dd>
              </div>
            ) : null}
            {packageSummary ? (
              <div>
                <dt>Package</dt>
                <dd>{packageSummary}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    );
  }

  function renderStatusBody() {
    if (loading) {
      return (
        <div className="shipping-request-loading" aria-busy="true">
          <div className="shipping-request-skeleton shipping-request-skeleton--title" />
          <div className="shipping-request-skeleton shipping-request-skeleton--line" />
          <div className="shipping-request-skeleton shipping-request-skeleton--card" />
          <p className="shipping-request-copy">Loading your shipping request…</p>
        </div>
      );
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
        <>
          {renderProgress()}
          {renderItemCard()}
          <div className="shipping-request-status-card">
            <h3>Payment received</h3>
            <p>We are preparing your shipping label. This usually takes a moment.</p>
          </div>
        </>
      );
    }

    if (view.state === "label_created") {
      return (
        <>
          {renderProgress()}
          {renderItemCard()}
          <div className="shipping-request-status-card">
            <h3>Label created</h3>
            <p>
              Your shipping label is ready. The hotel will ship your item shortly
              {view.selectedCarrier ? ` via ${view.selectedCarrier}` : ""}.
            </p>
          </div>
        </>
      );
    }

    if (view.state === "in_transit") {
      return (
        <>
          {renderProgress()}
          {renderItemCard()}
          <div className="shipping-request-status-card">
            <h3>Shipped</h3>
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
        </>
      );
    }

    if (view.state === "delivered") {
      return (
        <>
          {renderProgress()}
          {renderItemCard()}
          <div className="shipping-request-status-card">
            <h3>Delivered</h3>
            <p>Your item has been delivered. Thank you.</p>
          </div>
        </>
      );
    }

    const showAddressForm = view.state === "awaiting_guest";
    const showRates = view.state === "awaiting_payment";
    const totalDue =
      selectedRate?.amount ??
      (view.totalAmount != null ? Number(view.totalAmount) : null);

    return (
      <>
        {renderProgress()}
        <h1 className="shipping-request-title">We found your item</h1>
        <p className="shipping-request-copy">
          Please confirm where we should send it, then choose a delivery option.
        </p>
        <div className="shipping-request-fee-note">
          You pay only the carrier’s shipping cost. One Eyrie does not add a
          service fee.
        </div>
        {renderItemCard()}

        {showAddressForm ? (
          <form
            className="shipping-request-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleValidateAddress();
            }}
          >
            <h2 className="shipping-request-section-title">Shipping address</h2>
            <label className="shipping-request-field">
              <span>Full name</span>
              <input
                required
                autoComplete="name"
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
                autoComplete="address-line1"
                value={address.line1}
                onChange={(event) =>
                  setAddress((current) => ({ ...current, line1: event.target.value }))
                }
              />
            </label>
            <label className="shipping-request-field">
              <span>Address line 2</span>
              <input
                autoComplete="address-line2"
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
                  autoComplete="address-level2"
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
                  autoComplete="address-level1"
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
                  autoComplete="postal-code"
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
                  autoComplete="country"
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
                autoComplete="tel"
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
                autoComplete="email"
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
                {busy ? "Validating address…" : "Continue to shipping options"}
              </button>
            </div>
          </form>
        ) : null}

        {showRates ? (
          <div className="shipping-request-rates-section">
            <div className="shipping-request-ship-to">
              <div className="shipping-request-ship-to__top">
                <div>
                  <div className="shipping-request-ship-to__label">Shipping to</div>
                  <div className="shipping-request-ship-to__value">
                    {view.recipientSummary || "Confirmed address"}
                  </div>
                </div>
                <button
                  type="button"
                  className="shipping-request-back"
                  disabled={busy}
                  onClick={() => void handleEditAddress()}
                >
                  ← Back
                </button>
              </div>
              {packageSummary ? (
                <div className="shipping-request-ship-to__package">
                  Rated package: {packageSummary}
                </div>
              ) : null}
            </div>

            <div className="shipping-request-friendly-banner">
              Great news! We&apos;ve located your item. Select the shipping option
              that works best for you.
            </div>

            <h2 className="shipping-request-section-title">Choose a shipping option</h2>
            <p className="shipping-request-copy shipping-request-copy--tight">
              Pick the delivery speed that fits your timeline. You only pay the
              carrier shipping cost.
            </p>
            <p className="shipping-request-disclaimer">
              Shipping rates are supplied by the carrier and may expire. If rates
              expire, refresh them below without starting over.
            </p>

            {ratesExpired ? (
              <div className="shipping-request-message shipping-request-message--error">
                <div>These shipping rates have expired.</div>
                <button
                  type="button"
                  className="shipping-request-btn shipping-request-btn--secondary"
                  style={{ marginTop: "10px" }}
                  disabled={busy || ratesLoading}
                  onClick={() => void handleRefreshRates()}
                >
                  {ratesLoading ? "Refreshing rates…" : "Refresh shipping rates"}
                </button>
              </div>
            ) : null}

            <div className="shipping-request-rate-toolbar">
              <button
                type="button"
                className="shipping-request-refresh"
                disabled={busy || ratesLoading}
                onClick={() => void handleRefreshRates()}
              >
                {ratesLoading ? "Refreshing…" : "Refresh rates"}
              </button>
            </div>

            {ratesLoading && rates.length === 0 ? (
              <div className="shipping-request-loading" aria-busy="true">
                <div className="shipping-request-skeleton shipping-request-skeleton--rate" />
                <div className="shipping-request-skeleton shipping-request-skeleton--rate" />
                <div className="shipping-request-skeleton shipping-request-skeleton--rate" />
                <p className="shipping-request-copy">Retrieving live carrier rates…</p>
              </div>
            ) : rates.length === 0 ? (
              <p className="shipping-request-copy">
                No rates are available for this package and address. Go back and
                check the address, or contact the hotel.
              </p>
            ) : (
              <div
                className="shipping-request-rates"
                role="radiogroup"
                aria-label="Shipping options"
              >
                {rates.map((rate) => {
                  const selected = selectedRateId === rate.providerRateId;
                  const badges = rateBadges(rate);
                  return (
                    <button
                      key={rate.providerRateId}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`shipping-request-rate${
                        selected ? " shipping-request-rate--selected" : ""
                      }`}
                      disabled={busy}
                      onClick={() => void handleSelectRate(rate.providerRateId)}
                    >
                      <div className="shipping-request-rate__logo">
                        {rate.carrierLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={rate.carrierLogoUrl}
                            alt=""
                            className="shipping-request-rate__logo-img"
                          />
                        ) : (
                          <span className="shipping-request-rate__logo-fallback">
                            {rate.carrier.slice(0, 3).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="shipping-request-rate__main">
                        <div className="shipping-request-rate__carrier">
                          <span>{rate.carrier}</span>
                          {badges.map((badge) => (
                            <span
                              key={badge}
                              className={`shipping-request-rate__badge${
                                badge === "Fastest"
                                  ? " shipping-request-rate__badge--fast"
                                  : ""
                              }`}
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                        <div className="shipping-request-rate__service">
                          {rate.service}
                        </div>
                        <div className="shipping-request-rate__eta">
                          {rateEtaLabel(rate)}
                        </div>
                      </div>
                      <div className="shipping-request-rate__side">
                        <div className="shipping-request-rate__amount">
                          {formatMoney(rate.amount, rate.currency)}
                        </div>
                        <div className="shipping-request-rate__select-hint">
                          {selected ? (
                            <span className="shipping-request-rate__check">
                              ✓ Selected
                            </span>
                          ) : (
                            "Select"
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedRateId && totalDue != null ? (
              <div className="shipping-request-selected-summary shipping-request-selected-summary--emphasis">
                <div className="shipping-request-selected-summary__label">
                  Selected shipping option
                </div>
                <div className="shipping-request-selected-summary__value">
                  {selectedRate
                    ? `${selectedRate.carrier} · ${selectedRate.service}`
                    : `${view.selectedCarrier || "Carrier"} · ${
                        view.selectedService || "Service"
                      }`}
                </div>
                {selectedRate ? (
                  <div className="shipping-request-selected-summary__eta">
                    {rateEtaLabel(selectedRate)}
                  </div>
                ) : null}
                <div className="shipping-request-total-block">
                  <div className="shipping-request-total-block__label">
                    Shipping Total
                  </div>
                  <div className="shipping-request-total-block__amount">
                    {formatMoney(totalDue, selectedRate?.currency || view.currency)}
                  </div>
                  <div className="shipping-request-total-block__fee">
                    No One Eyrie Service Fee
                  </div>
                </div>
              </div>
            ) : null}

            <div className="shipping-request-actions">
              <button
                type="button"
                className="shipping-request-btn shipping-request-btn--primary shipping-request-btn--with-lock"
                disabled={busy || !selectedRateId || ratesExpired}
                onClick={handleContinueToPayment}
              >
                <span className="shipping-request-lock" aria-hidden="true">
                  🔒
                </span>
                Continue to payment
              </button>
              <p className="shipping-request-footnote">
                Secure checkout comes next. You will only be charged the selected
                shipping amount.
              </p>
            </div>
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
          <div className="shipping-request-hotel">
            {view?.propertyLogoUrl && !logoFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.propertyLogoUrl}
                alt={view.propertyName || "Hotel"}
                className="shipping-request-hotel__logo"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="shipping-request-hotel__monogram" aria-hidden="true">
                {propertyInitials(view?.propertyName || "Hotel")}
              </div>
            )}
            <div className="shipping-request-hotel__text">
              <p className="shipping-request-hotel__name">
                {loading ? "Loading hotel…" : view?.propertyName || "Hotel"}
              </p>
              {view?.propertyBrand ? (
                <p className="shipping-request-hotel__brand">{view.propertyBrand}</p>
              ) : (
                <p className="shipping-request-brand__eyebrow">
                  Lost &amp; Found Shipping
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="shipping-request-body">{renderStatusBody()}</div>
      </div>
    </main>
  );
}

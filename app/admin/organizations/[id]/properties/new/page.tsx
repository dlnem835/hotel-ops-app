"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import AddressFields from "@/app/components/address/AddressFields";
import {
  EMPTY_ADDRESS,
  type AddressValue,
} from "@/app/lib/address/format";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type {
  AdminOrganizationDetail,
  AdminPropertyDetail,
} from "@/app/lib/platform-admin/types";
import {
  DEFAULT_PROPERTY_TIMEZONE,
  isSupportedTimezone,
  resolveDefaultPropertyTimezone,
} from "@/app/lib/timezones";
import AdminErrorState from "@/app/admin/components/AdminErrorState";
import AdminTimezoneSelect from "@/app/admin/components/AdminTimezoneSelect";

export default function AdminCreatePropertyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const organizationId = params.id;

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [addressFields, setAddressFields] = useState<AddressValue>(EMPTY_ADDRESS);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_PROPERTY_TIMEZONE);
  const [timezoneReady, setTimezoneReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadTimezoneDefault() {
      if (!organizationId) {
        if (mounted) setTimezoneReady(true);
        return;
      }

      const parsedOrgId = Number.parseInt(organizationId, 10);
      const response = await adminFetch(`/api/admin/organizations/${organizationId}`);
      if (!mounted) return;

      if (!response.ok) {
        setTimezone(DEFAULT_PROPERTY_TIMEZONE);
        setTimezoneReady(true);
        return;
      }

      const organization = (await response.json()) as AdminOrganizationDetail;
      const existingTimezones = (organization.properties ?? []).map(
        (property) => property.timezone
      );
      setTimezone(
        resolveDefaultPropertyTimezone({
          organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : null,
          existingPropertyTimezones: existingTimezones,
        })
      );
      setTimezoneReady(true);
    }

    void loadTimezoneDefault();

    return () => {
      mounted = false;
    };
  }, [organizationId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;

    if (!isSupportedTimezone(timezone)) {
      setError("Select a supported timezone from the list.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const response = await adminFetch(`/api/admin/organizations/${organizationId}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        brand: brand.trim() || null,
        address: {
          line1: addressFields.line1,
          line2: addressFields.line2,
          city: addressFields.city,
          state: addressFields.state,
          postal: addressFields.postal,
          country: addressFields.country,
        },
        addressLine1: addressFields.line1,
        addressLine2: addressFields.line2,
        addressCity: addressFields.city,
        addressState: addressFields.state,
        addressPostal: addressFields.postal,
        addressCountry: addressFields.country,
        phoneNumber: phoneNumber.trim(),
        timezone,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `Request failed (${response.status})`);
      setSubmitting(false);
      return;
    }

    const property = (await response.json()) as AdminPropertyDetail;
    router.push(`/admin/properties/${property.id}`);
  }

  return (
    <div className="admin-portal__stack">
      <Link href={`/admin/organizations/${organizationId}`} className="admin-portal__back-link">
        ← Organization
      </Link>

      <section className="admin-portal__card">
        <h2 className="admin-portal__section-title">Create property</h2>
        <p className="admin-portal__muted">
          Property IDs are allocated from the platform sequence after the pilot property.
          Timezone belongs to this property and is used for property-scoped date and time
          calculations when it is the active property.
        </p>

        {error ? <AdminErrorState message={error} /> : null}

        <form className="admin-portal__form" onSubmit={handleSubmit}>
          <label className="admin-portal__field">
            <span>Property name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label className="admin-portal__field">
            <span>Brand (optional)</span>
            <input type="text" value={brand} onChange={(event) => setBrand(event.target.value)} />
          </label>

          <div className="admin-portal__field">
            <span>Address</span>
            <AddressFields
              variant="admin"
              idPrefix="admin-property"
              required={false}
              value={addressFields}
              onChange={setAddressFields}
            />
          </div>

          <label className="admin-portal__field">
            <span>Phone number</span>
            <input
              type="text"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </label>

          <label className="admin-portal__field">
            <span>Timezone</span>
            {timezoneReady ? (
              <AdminTimezoneSelect
                value={timezone}
                onChange={setTimezone}
                disabled={submitting}
              />
            ) : (
              <p className="admin-portal__muted">Loading timezone default…</p>
            )}
          </label>

          <div className="admin-portal__form-actions">
            <button
              type="submit"
              className="admin-portal__button admin-portal__button--primary"
              disabled={submitting || !timezoneReady}
            >
              {submitting ? "Creating…" : "Create property"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

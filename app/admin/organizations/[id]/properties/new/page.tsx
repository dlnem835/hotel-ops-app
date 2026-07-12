"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type { AdminPropertyDetail } from "@/app/lib/platform-admin/types";
import AdminErrorState from "@/app/admin/components/AdminErrorState";

export default function AdminCreatePropertyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const organizationId = params.id;

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;

    setSubmitting(true);
    setError(null);

    const response = await adminFetch(`/api/admin/organizations/${organizationId}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        brand: brand.trim() || null,
        address: address.trim(),
        phoneNumber: phoneNumber.trim(),
        timezone: timezone.trim() || "America/New_York",
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

          <label className="admin-portal__field">
            <span>Address</span>
            <input
              type="text"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </label>

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
            <input
              type="text"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </label>

          <div className="admin-portal__form-actions">
            <button
              type="submit"
              className="admin-portal__button admin-portal__button--primary"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create property"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

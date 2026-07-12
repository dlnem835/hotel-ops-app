"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type { AdminOrganizationDetail } from "@/app/lib/platform-admin/types";
import AdminErrorState from "@/app/admin/components/AdminErrorState";

export default function AdminCreateOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: Record<string, string> = { name: name.trim() };
    if (slug.trim()) {
      payload.slug = slug.trim();
    }

    const response = await adminFetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `Request failed (${response.status})`);
      setSubmitting(false);
      return;
    }

    const organization = (await response.json()) as AdminOrganizationDetail;
    router.push(`/admin/organizations/${organization.id}`);
  }

  return (
    <div className="admin-portal__stack">
      <Link href="/admin/organizations" className="admin-portal__back-link">
        ← Organizations
      </Link>

      <section className="admin-portal__card">
        <h2 className="admin-portal__section-title">Create organization</h2>
        <p className="admin-portal__muted">
          New organizations receive all modules enabled by default. Add the first property after
          creation.
        </p>

        {error ? <AdminErrorState message={error} /> : null}

        <form className="admin-portal__form" onSubmit={handleSubmit}>
          <label className="admin-portal__field">
            <span>Organization name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="organization"
            />
          </label>

          <label className="admin-portal__field">
            <span>Slug (optional)</span>
            <input
              type="text"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="auto-generated from name"
              autoComplete="off"
            />
          </label>

          <div className="admin-portal__form-actions">
            <button
              type="submit"
              className="admin-portal__button admin-portal__button--primary"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create organization"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

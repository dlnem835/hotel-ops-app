"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type { AdminOrganizationSummary } from "@/app/lib/platform-admin/types";
import AdminErrorState from "../components/AdminErrorState";
import AdminLoadingState from "../components/AdminLoadingState";
import AdminOrganizationsTable from "../components/AdminOrganizationsTable";

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<AdminOrganizationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadOrganizations() {
      setLoading(true);
      setError(null);

      const response = await adminFetch("/api/admin/organizations");
      if (!mounted) return;

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Request failed (${response.status})`);
        setLoading(false);
        return;
      }

      const body = (await response.json()) as { organizations: AdminOrganizationSummary[] };
      setOrganizations(body.organizations ?? []);
      setLoading(false);
    }

    void loadOrganizations();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <AdminLoadingState label="Loading organizations…" />;
  }

  if (error) {
    return <AdminErrorState message={error} />;
  }

  return (
    <section className="admin-portal__card">
      <div className="admin-portal__section-header">
        <h2 className="admin-portal__section-title">Organizations</h2>
        <Link href="/admin/organizations/new" className="admin-portal__button admin-portal__button--primary">
          Create organization
        </Link>
      </div>
      <AdminOrganizationsTable organizations={organizations} />
    </section>
  );
}

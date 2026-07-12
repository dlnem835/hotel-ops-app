"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type { AdminDashboardResponse } from "@/app/lib/platform-admin/types";
import AdminErrorState from "./components/AdminErrorState";
import AdminLoadingState from "./components/AdminLoadingState";
import AdminOrganizationsTable from "./components/AdminOrganizationsTable";

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      const response = await adminFetch("/api/admin/dashboard");
      if (!mounted) return;

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Request failed (${response.status})`);
        setLoading(false);
        return;
      }

      const body = (await response.json()) as AdminDashboardResponse;
      setDashboard(body);
      setLoading(false);
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <AdminLoadingState label="Loading dashboard…" />;
  }

  if (error || !dashboard) {
    return <AdminErrorState message={error ?? "Dashboard unavailable"} />;
  }

  return (
    <div className="admin-portal__stack">
      <section>
        <h2 className="admin-portal__section-title">Overview</h2>
        <div className="admin-portal__stats">
          <div className="admin-portal__stat">
            <p className="admin-portal__stat-label">Organizations</p>
            <p className="admin-portal__stat-value">{dashboard.organizationCount}</p>
          </div>
          <div className="admin-portal__stat">
            <p className="admin-portal__stat-label">Active organizations</p>
            <p className="admin-portal__stat-value">{dashboard.activeOrganizationCount}</p>
          </div>
          <div className="admin-portal__stat">
            <p className="admin-portal__stat-label">Properties</p>
            <p className="admin-portal__stat-value">{dashboard.propertyCount}</p>
          </div>
        </div>
      </section>

      <section className="admin-portal__card">
        <h2 className="admin-portal__section-title">Organizations</h2>
        <AdminOrganizationsTable organizations={dashboard.organizations} />
      </section>
    </div>
  );
}

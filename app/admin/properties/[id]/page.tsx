"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type { AdminPropertyDetail } from "@/app/lib/platform-admin/types";
import AdminErrorState from "../../components/AdminErrorState";
import AdminLoadingState from "../../components/AdminLoadingState";
import AdminStatusBadge from "../../components/AdminStatusBadge";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminPropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const [property, setProperty] = useState<AdminPropertyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const propertyId = params.id;

    async function loadProperty() {
      if (!propertyId) return;

      setLoading(true);
      setError(null);

      const response = await adminFetch(`/api/admin/properties/${propertyId}`);
      if (!mounted) return;

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Request failed (${response.status})`);
        setLoading(false);
        return;
      }

      const body = (await response.json()) as AdminPropertyDetail;
      setProperty(body);
      setLoading(false);
    }

    void loadProperty();

    return () => {
      mounted = false;
    };
  }, [params.id]);

  if (loading) {
    return <AdminLoadingState label="Loading property…" />;
  }

  if (error || !property) {
    return <AdminErrorState message={error ?? "Property not found"} />;
  }

  return (
    <div className="admin-portal__stack">
      <Link
        href={`/admin/organizations/${property.organizationId}`}
        className="admin-portal__back-link"
      >
        ← {property.organizationName ?? "Organization"}
      </Link>

      <section className="admin-portal__card">
        <h2 className="admin-portal__section-title">{property.name}</h2>
        <dl className="admin-portal__meta-grid">
          <div className="admin-portal__meta-item">
            <dt>Organization</dt>
            <dd>
              <Link
                href={`/admin/organizations/${property.organizationId}`}
                className="admin-portal__link"
              >
                {property.organizationName ?? `Org #${property.organizationId}`}
              </Link>
            </dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Property ID</dt>
            <dd>{property.id}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Status</dt>
            <dd>
              <AdminStatusBadge status={property.active ? "active" : "inactive"} />
            </dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Brand</dt>
            <dd>{property.brand || "—"}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Timezone</dt>
            <dd>{property.timezone}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Onboarding</dt>
            <dd>{property.onboardingLabel ?? "—"}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Areas configured</dt>
            <dd>{property.areaCount ?? 0}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Address</dt>
            <dd>{property.address || "—"}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Phone</dt>
            <dd>{property.phoneNumber || "—"}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Created</dt>
            <dd>{formatDate(property.createdAt)}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Updated</dt>
            <dd>{formatDate(property.updatedAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

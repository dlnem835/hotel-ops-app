"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type { AdminOrganizationDetail } from "@/app/lib/platform-admin/types";
import AdminErrorState from "../../components/AdminErrorState";
import AdminLoadingState from "../../components/AdminLoadingState";
import AdminInviteGmForm from "../../components/AdminInviteGmForm";
import AdminInvitationsTable from "../../components/AdminInvitationsTable";
import AdminOrganizationLifecycleActions from "../../components/AdminOrganizationLifecycleActions";
import AdminStatusBadge from "../../components/AdminStatusBadge";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminOrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const [organization, setOrganization] = useState<AdminOrganizationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadOrganization() {
    const organizationId = params.id;
    if (!organizationId) return;

    setLoading(true);
    setError(null);

    const response = await adminFetch(`/api/admin/organizations/${organizationId}`);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `Request failed (${response.status})`);
      setLoading(false);
      return;
    }

    const body = (await response.json()) as AdminOrganizationDetail;
    setOrganization(body);
    setLoading(false);
  }

  useEffect(() => {
    void loadOrganization();
  }, [params.id]);

  if (loading) {
    return <AdminLoadingState label="Loading organization…" />;
  }

  if (error || !organization) {
    return <AdminErrorState message={error ?? "Organization not found"} />;
  }

  return (
    <div className="admin-portal__stack">
      <Link href="/admin/organizations" className="admin-portal__back-link">
        ← Organizations
      </Link>

      <section className="admin-portal__card">
        <h2 className="admin-portal__section-title">{organization.name}</h2>
        <dl className="admin-portal__meta-grid">
          <div className="admin-portal__meta-item">
            <dt>Slug</dt>
            <dd>{organization.slug}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Status</dt>
            <dd>
              <AdminStatusBadge status={organization.status} />
            </dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Onboarding</dt>
            <dd>{organization.onboardingLabel}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Pending invitations</dt>
            <dd>{organization.pendingInvitations}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Created</dt>
            <dd>{formatDate(organization.createdAt)}</dd>
          </div>
          <div className="admin-portal__meta-item">
            <dt>Updated</dt>
            <dd>{formatDate(organization.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      {actionError ? <AdminErrorState message={actionError} /> : null}

      <AdminOrganizationLifecycleActions
        organization={organization}
        onOrganizationUpdated={setOrganization}
        onError={setActionError}
      />

      {organization.canInviteGm ? (
        <AdminInviteGmForm
          organization={organization}
          onInvitationCreated={() => {
            setActionError(null);
            void loadOrganization();
          }}
          onError={setActionError}
        />
      ) : null}

      <section className="admin-portal__card">
        <h3 className="admin-portal__section-title">GM invitations</h3>
        <AdminInvitationsTable invitations={organization.invitations} />
      </section>

      <section className="admin-portal__card">
        <h3 className="admin-portal__section-title">Onboarding status</h3>
        <ul className="admin-portal__checklist">
          <li>{organization.onboarding.organizationCreated ? "✓" : "○"} Organization created</li>
          <li>{organization.onboarding.propertyCreated ? "✓" : "○"} Property created</li>
          <li>{organization.onboarding.gmInvited ? "✓" : "○"} GM invited</li>
          <li>{organization.onboarding.gmAccepted ? "✓" : "○"} GM accepted invitation</li>
          <li>{organization.onboarding.hotelConfigured ? "✓" : "○"} Hotel setup started</li>
        </ul>
      </section>

      <section className="admin-portal__card">
        <h3 className="admin-portal__section-title">Enabled modules</h3>
        {organization.modules.length === 0 ? (
          <p className="admin-portal__muted">No module entitlements configured.</p>
        ) : (
          <div className="admin-portal__table-wrap">
            <table className="admin-portal__table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {organization.modules.map((module) => (
                  <tr key={module.moduleKey}>
                    <td>{module.moduleKey}</td>
                    <td>{module.enabled ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-portal__card">
        <div className="admin-portal__section-header">
          <h3 className="admin-portal__section-title">Properties</h3>
          <Link
            href={`/admin/organizations/${organization.id}/properties/new`}
            className="admin-portal__button admin-portal__button--primary"
          >
            Add property
          </Link>
        </div>
        {organization.properties.length === 0 ? (
          <p className="admin-portal__muted">No properties yet.</p>
        ) : (
          <div className="admin-portal__table-wrap">
            <table className="admin-portal__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Timezone</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {organization.properties.map((property) => (
                  <tr key={property.id}>
                    <td>
                      <Link
                        href={`/admin/properties/${property.id}`}
                        className="admin-portal__link"
                      >
                        {property.name}
                      </Link>
                    </td>
                    <td>
                      <AdminStatusBadge status={property.active ? "active" : "inactive"} />
                    </td>
                    <td>{property.timezone}</td>
                    <td>{formatDate(property.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

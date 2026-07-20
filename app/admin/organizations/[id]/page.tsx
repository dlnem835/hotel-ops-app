"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import { isOrganizationLevelAdministrator } from "@/app/lib/platform-admin/roles";
import type { AdminOrganizationDetail } from "@/app/lib/platform-admin/types";
import AdminErrorState from "../../components/AdminErrorState";
import AdminLoadingState from "../../components/AdminLoadingState";
import AdminInviteAdministratorForm from "../../components/AdminInviteAdministratorForm";
import AdminAdministratorsTable from "../../components/AdminAdministratorsTable";
import AdminModuleControls from "../../components/AdminModuleControls";
import AdminOrganizationLifecycleActions from "../../components/AdminOrganizationLifecycleActions";
import AdminEditOrganizationModal from "../../components/AdminEditOrganizationModal";
import AdminStatusBadge from "../../components/AdminStatusBadge";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminOrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const [organization, setOrganization] = useState<AdminOrganizationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  async function loadOrganization(options?: { soft?: boolean }) {
    const organizationId = params.id;
    if (!organizationId) return;

    const soft = Boolean(options?.soft);
    if (!soft) {
      setLoading(true);
      setError(null);
    }

    const response = await adminFetch(`/api/admin/organizations/${organizationId}`);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!soft) {
        setError(body?.error ?? `Request failed (${response.status})`);
        setLoading(false);
      }
      return;
    }

    const body = (await response.json()) as AdminOrganizationDetail;
    setOrganization(body);
    if (!soft) {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrganization();
  }, [params.id]);

  useEffect(() => {
    if (!actionSuccess) return;
    const timer = window.setTimeout(() => setActionSuccess(null), 6000);
    return () => window.clearTimeout(timer);
  }, [actionSuccess]);

  const organizationAdministrators = useMemo(() => {
    if (!organization) return [];
    return organization.invitations.filter((invitation) =>
      isOrganizationLevelAdministrator(invitation)
    );
  }, [organization]);

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

      {actionSuccess ? (
        <div className="admin-portal__toast" role="status">
          {actionSuccess}
        </div>
      ) : null}

      <section className="admin-portal__card">
        <div className="admin-portal__section-header">
          <h2 className="admin-portal__section-title">{organization.name}</h2>
          <button
            type="button"
            className="admin-portal__button admin-portal__button--primary"
            onClick={() => setEditOpen(true)}
          >
            Edit Organization
          </button>
        </div>
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
        onSuccess={(message) => {
          setActionError(null);
          setActionSuccess(message);
        }}
        onError={(message) => {
          setActionSuccess(null);
          setActionError(message);
        }}
      />

      {organization.canInviteAdministrator ? (
        <AdminInviteAdministratorForm
          organization={organization}
          scope="organization"
          onInvitationCreated={() => {
            setActionError(null);
            void loadOrganization({ soft: true });
          }}
          onSuccess={(message) => {
            setActionError(null);
            setActionSuccess(message);
          }}
          onError={(message) => {
            setActionSuccess(null);
            setActionError(message);
          }}
        />
      ) : null}

      <section className="admin-portal__card">
        <h3 className="admin-portal__section-title">Administrators</h3>
        <p className="admin-portal__muted">
          Primary Owner and organization-wide administrators. Property General
          Managers are managed on each property page.
        </p>
        <AdminAdministratorsTable
          organizationId={organization.id}
          organizationName={organization.name}
          invitations={organizationAdministrators}
          properties={organization.properties}
          modules={organization.modules}
          emptyLabel="No organization-level administrators yet."
          onChanged={() => {
            setActionError(null);
            void loadOrganization({ soft: true });
          }}
          onError={(message) => {
            setActionSuccess(null);
            setActionError(message);
          }}
          onSuccess={(message, details) => {
            setActionError(null);
            setActionSuccess(message);
            if (details) {
              setOrganization((current) => {
                if (!current) return current;
                return {
                  ...current,
                  invitations: current.invitations.map((invitation) =>
                    invitation.id === details.invitationId
                      ? { ...invitation, email: details.email }
                      : invitation
                  ),
                };
              });
            }
          }}
        />
      </section>

      <section className="admin-portal__card">
        <h3 className="admin-portal__section-title">Onboarding status</h3>
        <ul className="admin-portal__checklist">
          <li>{organization.onboarding.organizationCreated ? "✓" : "○"} Organization created</li>
          <li>{organization.onboarding.propertyCreated ? "✓" : "○"} Property created</li>
          <li>{organization.onboarding.administratorInvited ? "✓" : "○"} Administrator invited</li>
          <li>{organization.onboarding.administratorAccepted ? "✓" : "○"} Administrator accepted invitation</li>
          <li>{organization.onboarding.hotelConfigured ? "✓" : "○"} Hotel setup started</li>
        </ul>
      </section>

      <AdminModuleControls
        organizationId={organization.id}
        modules={organization.modules}
        onModulesUpdated={(modules) => {
          setActionError(null);
          setOrganization((current) => (current ? { ...current, modules } : current));
        }}
        onError={setActionError}
      />

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

      <AdminEditOrganizationModal
        open={editOpen}
        organization={organization}
        onClose={() => setEditOpen(false)}
        onSaved={(updated, message) => {
          setOrganization(updated);
          setEditOpen(false);
          setActionError(null);
          setActionSuccess(message);
        }}
        onError={(message) => {
          setActionSuccess(null);
          setActionError(message);
        }}
      />
    </div>
  );
}

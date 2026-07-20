"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type {
  AdminOrganizationDetail,
  AdminPropertyDetail,
} from "@/app/lib/platform-admin/types";
import AdminErrorState from "../../components/AdminErrorState";
import AdminLoadingState from "../../components/AdminLoadingState";
import AdminStatusBadge from "../../components/AdminStatusBadge";
import AdminInviteAdministratorForm from "../../components/AdminInviteAdministratorForm";
import AdminAdministratorsTable from "../../components/AdminAdministratorsTable";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminPropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const [property, setProperty] = useState<AdminPropertyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProperty(options?: { soft?: boolean }) {
    const propertyId = params.id;
    if (!propertyId) return;

    const soft = Boolean(options?.soft);
    if (!soft) {
      setLoading(true);
      setError(null);
    }

    const response = await adminFetch(`/api/admin/properties/${propertyId}`);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!soft) {
        setError(body?.error ?? `Request failed (${response.status})`);
        setLoading(false);
      }
      return;
    }

    const body = (await response.json()) as AdminPropertyDetail;
    setProperty(body);
    if (!soft) {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProperty();
  }, [params.id]);

  useEffect(() => {
    if (!actionSuccess) return;
    const timer = window.setTimeout(() => setActionSuccess(null), 6000);
    return () => window.clearTimeout(timer);
  }, [actionSuccess]);

  const inviteOrganization = useMemo((): AdminOrganizationDetail | null => {
    if (!property) return null;
    return {
      id: property.organizationId,
      name: property.organizationName ?? `Org #${property.organizationId}`,
      slug: property.organizationSlug ?? "",
      status: property.organizationStatus ?? "active",
      propertyCount: 1,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
      properties: [
        {
          id: property.id,
          organizationId: property.organizationId,
          name: property.name,
          brand: property.brand,
          address: property.address,
          phoneNumber: property.phoneNumber,
          timezone: property.timezone,
          active: property.active,
          createdAt: property.createdAt,
          updatedAt: property.updatedAt,
        },
      ],
      modules: property.modules ?? [],
      onboarding: property.onboarding ?? {
        organizationCreated: true,
        propertyCreated: true,
        administratorInvited: false,
        administratorAccepted: false,
        hotelConfigured: false,
      },
      onboardingLabel: property.onboardingLabel ?? "",
      pendingInvitations: 0,
      lifecycle: {
        canSuspend: false,
        canReactivate: false,
        canDeleteTestOrganization: false,
        deleteBlockers: [],
      },
      // Property invites never create a Primary Owner; mark primary as present.
      invitations: [
        {
          id: "property-page-primary-sentinel",
          organizationId: property.organizationId,
          propertyId: property.id,
          propertyName: property.name,
          email: "",
          firstName: "",
          lastName: "",
          jobTitle: "",
          status: "accepted",
          isPrimary: true,
          orgRole: "org_owner",
          propertyRole: "property_admin",
          roleLabel: "Primary Owner",
          scopeLabel: "Entire organization",
          assignedPropertyIds: [],
          modulePermissions: null,
          active: true,
          authUserId: null,
          username: null,
          expiresAt: null,
          createdAt: property.createdAt,
          acceptedAt: property.createdAt,
        },
      ],
      canInviteAdministrator: Boolean(property.canInviteAdministrator),
    };
  }, [property]);

  if (loading) {
    return <AdminLoadingState label="Loading property…" />;
  }

  if (error || !property) {
    return <AdminErrorState message={error ?? "Property not found"} />;
  }

  const invitations = property.invitations ?? [];
  const modules = property.modules ?? [];

  return (
    <div className="admin-portal__stack">
      <Link
        href={`/admin/organizations/${property.organizationId}`}
        className="admin-portal__back-link"
      >
        ← {property.organizationName ?? "Organization"}
      </Link>

      {actionSuccess ? (
        <div className="admin-portal__toast" role="status">
          {actionSuccess}
        </div>
      ) : null}

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

      {actionError ? <AdminErrorState message={actionError} /> : null}

      {property.canInviteAdministrator && inviteOrganization ? (
        <AdminInviteAdministratorForm
          organization={inviteOrganization}
          scope="property"
          lockedPropertyId={property.id}
          onInvitationCreated={() => {
            setActionError(null);
            void loadProperty({ soft: true });
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
        <h3 className="admin-portal__section-title">Property Administrators</h3>
        <p className="admin-portal__muted">
          General Managers and other administrators scoped to this property only.
        </p>
        <AdminAdministratorsTable
          organizationId={property.organizationId}
          organizationName={property.organizationName ?? `Org #${property.organizationId}`}
          invitations={invitations}
          properties={[
            {
              id: property.id,
              organizationId: property.organizationId,
              name: property.name,
              brand: property.brand,
              address: property.address,
              phoneNumber: property.phoneNumber,
              timezone: property.timezone,
              active: property.active,
              createdAt: property.createdAt,
              updatedAt: property.updatedAt,
            },
          ]}
          modules={modules}
          emptyLabel="No property administrators yet."
          onChanged={() => {
            setActionError(null);
            void loadProperty({ soft: true });
          }}
          onError={(message) => {
            setActionSuccess(null);
            setActionError(message);
          }}
          onSuccess={(message, details) => {
            setActionError(null);
            setActionSuccess(message);
            if (details) {
              setProperty((current) => {
                if (!current?.invitations) return current;
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
    </div>
  );
}

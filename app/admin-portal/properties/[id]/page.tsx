"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/supabaseClient";
import { orgAdminFetch } from "@/app/lib/org-admin/org-admin-fetch";
import type {
  AdminOrganizationDetail,
  AdminPropertyDetail,
} from "@/app/lib/platform-admin/types";
import OneEyrieSidebar from "@/app/components/OneEyrieSidebar";
import OneEyriePageHeader from "@/app/components/OneEyriePageHeader";
import {
  APP_SHELL,
  APP_SHELL_CLASS,
  MAIN_CONTENT,
  MAIN_CONTENT_CLASS,
} from "@/app/lib/oneEyrieLayout";
import {
  AdministrationApiProvider,
  ORGANIZATION_ADMIN_CAPABILITIES,
  AdminAdministratorsTable,
  AdminInviteLeaderModal,
  AdminStatusBadge,
} from "@/app/components/administration";
import "@/app/admin/admin.css";

const ORG_ADMIN_BASE_PATH = "/api/org-admin";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminPortalPropertyLeadershipPage() {
  const params = useParams<{ id: string }>();
  const [property, setProperty] = useState<AdminPropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  async function loadProperty(options?: { soft?: boolean }) {
    const propertyId = params.id;
    if (!propertyId) return;

    const soft = Boolean(options?.soft);
    if (!soft) {
      setLoading(true);
      setError(null);
    }

    const response = await orgAdminFetch(
      `${ORG_ADMIN_BASE_PATH}/properties/${propertyId}`
    );
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
    let mounted = true;
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }
      if (mounted) {
        await loadProperty();
      }
    }
    void init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      legalName: null,
      contactEmail: null,
      contactPhone: null,
      businessAddress: null,
      contactName: null,
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
      invitations: [
        {
          id: "org-admin-property-primary-sentinel",
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
          orgAdminPortalAccess: true,
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

  function renderBody() {
    if (loading) {
      return <p className="admin-portal__muted">Loading property…</p>;
    }
    if (error || !property) {
      return (
        <div className="admin-portal__card">
          <p className="admin-portal__error">{error ?? "Property not found"}</p>
          <Link href="/admin-portal" className="admin-portal__link">
            ← Back to Admin Portal
          </Link>
        </div>
      );
    }

    const invitations = property.invitations ?? [];
    const modules = property.modules ?? [];

    return (
      <AdministrationApiProvider
        basePath={ORG_ADMIN_BASE_PATH}
        capabilities={ORGANIZATION_ADMIN_CAPABILITIES}
      >
        <div className="admin-portal__stack">
          <Link href="/admin-portal" className="admin-portal__back-link">
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
                <dt>Status</dt>
                <dd>
                  <AdminStatusBadge
                    status={property.active ? "active" : "inactive"}
                  />
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
            </dl>
          </section>

          {actionError ? (
            <div className="admin-portal__card">
              <p className="admin-portal__error">{actionError}</p>
            </div>
          ) : null}

          <section className="admin-portal__card">
            <div className="admin-portal__section-header">
              <h3 className="admin-portal__section-title">Property Leadership</h3>
              {property.canInviteAdministrator && invitations.length > 0 ? (
                <button
                  type="button"
                  className="admin-portal__button admin-portal__button--primary"
                  onClick={() => setInviteOpen(true)}
                >
                  Add Property Leader
                </button>
              ) : null}
            </div>
            <p className="admin-portal__muted">
              Leadership assigned only to this hotel — General Managers and other
              on-property leaders.
            </p>
            <AdminAdministratorsTable
              organizationId={property.organizationId}
              organizationName={
                property.organizationName ?? `Org #${property.organizationId}`
              }
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
              emptyLabel="No property leaders have been added."
              emptyContent={
                <div className="admin-portal__empty-state">
                  <p className="admin-portal__muted">
                    No property leaders have been added.
                  </p>
                  {property.canInviteAdministrator ? (
                    <button
                      type="button"
                      className="admin-portal__button admin-portal__button--primary"
                      onClick={() => setInviteOpen(true)}
                    >
                      Add Property Leader
                    </button>
                  ) : null}
                </div>
              }
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

          {inviteOrganization ? (
            <AdminInviteLeaderModal
              open={inviteOpen}
              organization={inviteOrganization}
              scope="property"
              lockedPropertyId={property.id}
              onClose={() => setInviteOpen(false)}
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
        </div>
      </AdministrationApiProvider>
    );
  }

  return (
    <div style={APP_SHELL} className={APP_SHELL_CLASS}>
      <OneEyrieSidebar active="Admin Portal" />
      <main
        style={MAIN_CONTENT}
        className={`${MAIN_CONTENT_CLASS} one-eyrie-settings-page`}
      >
        <OneEyriePageHeader
          title="Property Leadership"
          subtitle="Manage the leaders assigned to this hotel"
        />
        {renderBody()}
      </main>
    </div>
  );
}

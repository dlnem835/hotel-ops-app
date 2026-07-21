"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/supabaseClient";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";
import { orgAdminFetch } from "@/app/lib/org-admin/org-admin-fetch";
import { isOrgWideRole, isOrganizationLevelAdministrator } from "@/app/lib/platform-admin/roles";
import type { AdminOrganizationDetail } from "@/app/lib/platform-admin/types";
import type { TenantContextResponse } from "@/app/lib/tenant/types";
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
  AdminEditOrganizationModal,
  AdminStatusBadge,
} from "@/app/components/administration";
import "@/app/admin/admin.css";

const ORG_ADMIN_BASE_PATH = "/api/org-admin";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function OrganizationAdminPage() {
  const [organization, setOrganization] = useState<AdminOrganizationDetail | null>(
    null
  );
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState<number | null>(null);

  async function loadOrganizationDetail(orgId: number, options?: { soft?: boolean }) {
    const soft = Boolean(options?.soft);
    if (!soft) {
      setLoading(true);
      setError(null);
    }

    const response = await orgAdminFetch(
      `${ORG_ADMIN_BASE_PATH}/organizations/${orgId}`
    );
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
    let mounted = true;

    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const contextResponse = await tenantFetch("/api/tenant/context");
      if (!mounted) return;

      if (!contextResponse.ok) {
        setError("Unable to load your organization.");
        setLoading(false);
        return;
      }

      const context = (await contextResponse.json()) as TenantContextResponse;
      const role = context.organization?.role ?? null;
      setOrgRole(role);

      if (!role || !isOrgWideRole(role)) {
        setNotAuthorized(true);
        setLoading(false);
        return;
      }

      setOrganizationId(context.organization.id);
      await loadOrganizationDetail(context.organization.id);
    }

    void init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!actionSuccess) return;
    const timer = window.setTimeout(() => setActionSuccess(null), 6000);
    return () => window.clearTimeout(timer);
  }, [actionSuccess]);

  const organizationLeaders = useMemo(() => {
    if (!organization) return [];
    return organization.invitations.filter((invitation) =>
      isOrganizationLevelAdministrator(invitation)
    );
  }, [organization]);

  function renderBody() {
    if (loading) {
      return <p className="admin-portal__muted">Loading your organization…</p>;
    }

    if (notAuthorized) {
      return (
        <div className="admin-portal__card">
          <h2 className="admin-portal__section-title">
            Organization administration
          </h2>
          <p className="admin-portal__muted">
            Organization administration is available to Primary Owners and
            Organization Administrators. Your current role
            {orgRole ? ` (${orgRole})` : ""} does not include organization-level
            management. Contact your organization&apos;s Primary Owner if you need
            access.
          </p>
          <Link href="/settings" className="admin-portal__link">
            ← Back to Settings
          </Link>
        </div>
      );
    }

    if (error || !organization || organizationId == null) {
      return (
        <div className="admin-portal__card">
          <p className="admin-portal__error">
            {error ?? "Organization not found"}
          </p>
          <Link href="/settings" className="admin-portal__link">
            ← Back to Settings
          </Link>
        </div>
      );
    }

    return (
      <AdministrationApiProvider
        basePath={ORG_ADMIN_BASE_PATH}
        capabilities={ORGANIZATION_ADMIN_CAPABILITIES}
      >
        <div className="admin-portal__stack">
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
                <dt>Status</dt>
                <dd>
                  <AdminStatusBadge status={organization.status} />
                </dd>
              </div>
              <div className="admin-portal__meta-item">
                <dt>Properties</dt>
                <dd>{organization.properties.length}</dd>
              </div>
              <div className="admin-portal__meta-item">
                <dt>Contact email</dt>
                <dd>{organization.contactEmail || "—"}</dd>
              </div>
              <div className="admin-portal__meta-item">
                <dt>Contact phone</dt>
                <dd>{organization.contactPhone || "—"}</dd>
              </div>
              <div className="admin-portal__meta-item">
                <dt>Contact person</dt>
                <dd>{organization.contactName || "—"}</dd>
              </div>
              <div className="admin-portal__meta-item">
                <dt>Business address</dt>
                <dd>{organization.businessAddress || "—"}</dd>
              </div>
              <div className="admin-portal__meta-item">
                <dt>Pending invitations</dt>
                <dd>{organization.pendingInvitations}</dd>
              </div>
              <div className="admin-portal__meta-item">
                <dt>Created</dt>
                <dd>{formatDate(organization.createdAt)}</dd>
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
              <h3 className="admin-portal__section-title">Organization Leadership</h3>
              {organization.canInviteAdministrator && organizationLeaders.length > 0 ? (
                <button
                  type="button"
                  className="admin-portal__button admin-portal__button--primary"
                  onClick={() => setInviteOpen(true)}
                >
                  Add Organization Leader
                </button>
              ) : null}
            </div>
            <p className="admin-portal__muted">
              Primary Owner and corporate or regional leaders. Hotel General
              Managers and other property leaders are managed on each property.
            </p>
            <AdminAdministratorsTable
              organizationId={organization.id}
              organizationName={organization.name}
              invitations={organizationLeaders}
              properties={organization.properties}
              modules={organization.modules}
              emptyLabel="No organization leaders have been added."
              emptyContent={
                <div className="admin-portal__empty-state">
                  <p className="admin-portal__muted">
                    No organization leaders have been added.
                  </p>
                  {organization.canInviteAdministrator ? (
                    <button
                      type="button"
                      className="admin-portal__button admin-portal__button--primary"
                      onClick={() => setInviteOpen(true)}
                    >
                      Add Organization Leader
                    </button>
                  ) : null}
                </div>
              }
              onChanged={() => {
                setActionError(null);
                void loadOrganizationDetail(organization.id, { soft: true });
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
            <div className="admin-portal__section-header">
              <h3 className="admin-portal__section-title">Properties</h3>
            </div>
            <p className="admin-portal__muted">
              Properties are provisioned by One Eyrie. Manage each property&apos;s
              leadership from its page.
            </p>
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
                      <th>Leadership</th>
                    </tr>
                  </thead>
                  <tbody>
                    {organization.properties.map((property) => (
                      <tr key={property.id}>
                        <td>{property.name}</td>
                        <td>
                          <AdminStatusBadge
                            status={property.active ? "active" : "inactive"}
                          />
                        </td>
                        <td>{property.timezone}</td>
                        <td>
                          <Link
                            href={`/settings/organization/properties/${property.id}`}
                            className="admin-portal__link"
                          >
                            Manage leadership →
                          </Link>
                        </td>
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

          <AdminInviteLeaderModal
            open={inviteOpen}
            organization={organization}
            scope="organization"
            onClose={() => setInviteOpen(false)}
            onInvitationCreated={() => {
              setActionError(null);
              void loadOrganizationDetail(organization.id, { soft: true });
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
        </div>
      </AdministrationApiProvider>
    );
  }

  return (
    <div style={APP_SHELL} className={APP_SHELL_CLASS}>
      <OneEyrieSidebar active="Settings" />
      <main
        style={MAIN_CONTENT}
        className={`${MAIN_CONTENT_CLASS} one-eyrie-settings-page`}
      >
        <OneEyriePageHeader
          title="Organization"
          subtitle="Manage your organization, leadership, and property teams"
        />
        {renderBody()}
      </main>
    </div>
  );
}

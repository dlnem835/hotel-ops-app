"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AddressFields from "@/app/components/address/AddressFields";
import { EMPTY_ADDRESS, type AddressValue } from "@/app/lib/address/format";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type {
  AdminOrganizationDetail,
  AdminPropertyDetail,
} from "@/app/lib/platform-admin/types";
import AdminErrorState from "../../components/AdminErrorState";
import AdminLoadingState from "../../components/AdminLoadingState";
import AdminStatusBadge from "../../components/AdminStatusBadge";
import AdminInviteLeaderModal from "../../components/AdminInviteLeaderModal";
import AdminAdministratorsTable from "../../components/AdminAdministratorsTable";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function AdminPropertyAddressPrompt({
  property,
  onSaved,
  onError,
}: {
  property: AdminPropertyDetail;
  onSaved: (property: AdminPropertyDetail) => void;
  onError: (message: string | null) => void;
}) {
  const [address, setAddress] = useState<AddressValue>({
    ...EMPTY_ADDRESS,
    line1: property.addressLine1 || "",
    line2: property.addressLine2 || "",
    city: property.addressCity || "",
    state: property.addressState || "",
    postal: property.addressPostal || "",
    country: property.addressCountry || "US",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    onError(null);
    const response = await adminFetch(`/api/admin/properties/${property.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    const body = (await response.json().catch(() => null)) as
      | AdminPropertyDetail
      | { error?: string }
      | null;
    setSaving(false);
    if (!response.ok) {
      onError(
        body && "error" in body && body.error
          ? body.error
          : `Request failed (${response.status})`
      );
      return;
    }
    onSaved(body as AdminPropertyDetail);
  }

  return (
    <section className="admin-portal__card">
      <h3 className="admin-portal__section-title">Complete property address</h3>
      <p className="admin-portal__muted">
        This property still has an incomplete structured address. Complete it once
        — it becomes the canonical Ship From address for automated Lost &amp; Found
        shipping.
      </p>
      <form className="admin-portal__form" onSubmit={(event) => void handleSubmit(event)}>
        <AddressFields
          variant="admin"
          idPrefix="admin-property-fix"
          value={address}
          onChange={setAddress}
        />
        <div className="admin-portal__form-actions">
          <button
            type="submit"
            className="admin-portal__button admin-portal__button--primary"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save structured address"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function AdminPropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const [property, setProperty] = useState<AdminPropertyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

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
          addressLine1: property.addressLine1,
          addressLine2: property.addressLine2,
          addressCity: property.addressCity,
          addressState: property.addressState,
          addressPostal: property.addressPostal,
          addressCountry: property.addressCountry,
          addressComplete: property.addressComplete,
          addressIncompleteFields: property.addressIncompleteFields,
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
            <dd>
              {property.addressComplete ? (
                property.address || "—"
              ) : (
                <span style={{ color: "#FECACA" }}>
                  Incomplete
                  {property.addressIncompleteFields?.length
                    ? ` — missing ${property.addressIncompleteFields.join(", ")}`
                    : ""}
                </span>
              )}
            </dd>
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

      {!property.addressComplete ? (
        <AdminPropertyAddressPrompt
          property={property}
          onSaved={(next) => {
            setProperty(next);
            setActionSuccess("Property address updated.");
          }}
          onError={setActionError}
        />
      ) : null}

      {actionError ? <AdminErrorState message={actionError} /> : null}

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
          organizationName={property.organizationName ?? `Org #${property.organizationId}`}
          invitations={invitations}
          properties={[
            {
              id: property.id,
              organizationId: property.organizationId,
              name: property.name,
              brand: property.brand,
              address: property.address,
              addressLine1: property.addressLine1,
              addressLine2: property.addressLine2,
              addressCity: property.addressCity,
              addressState: property.addressState,
              addressPostal: property.addressPostal,
              addressCountry: property.addressCountry,
              addressComplete: property.addressComplete,
              addressIncompleteFields: property.addressIncompleteFields,
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
  );
}

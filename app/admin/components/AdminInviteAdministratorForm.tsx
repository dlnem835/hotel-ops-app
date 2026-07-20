"use client";

import { FormEvent, useMemo, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import {
  ADMINISTRATOR_INVITE_ROLES,
  ORGANIZATION_ADMIN_JOB_TITLE_SUGGESTIONS,
  PROPERTY_ADMIN_JOB_TITLE_SUGGESTIONS,
  type AdministratorInviteRole,
} from "@/app/lib/platform-admin/roles";
import type {
  AdminOrganizationDetail,
  AdminOrganizationInvitation,
} from "@/app/lib/platform-admin/types";

type AdminInviteAdministratorFormProps = {
  organization: AdminOrganizationDetail;
  /** organization = org-wide invites; property = GM / property admin for one property. */
  scope?: "organization" | "property";
  lockedPropertyId?: number;
  onInvitationCreated: (invitation: AdminOrganizationInvitation) => void;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export default function AdminInviteAdministratorForm({
  organization,
  scope = "organization",
  lockedPropertyId,
  onInvitationCreated,
  onError,
  onSuccess,
}: AdminInviteAdministratorFormProps) {
  const isPropertyScope = scope === "property";

  const hasPrimary = organization.invitations.some(
    (invitation) =>
      invitation.isPrimary &&
      (invitation.status === "pending" || invitation.status === "accepted")
  );

  const defaultPropertyId =
    lockedPropertyId ??
    (organization.properties.length === 1 ? organization.properties[0].id : null);

  const initialRole: AdministratorInviteRole = isPropertyScope
    ? "property_administrator"
    : "organization_admin";

  const [role, setRole] = useState<AdministratorInviteRole>(initialRole);
  const [propertyId, setPropertyId] = useState(
    defaultPropertyId != null ? String(defaultPropertyId) : ""
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const effectiveRole: AdministratorInviteRole = isPropertyScope
    ? "property_administrator"
    : !hasPrimary
      ? "organization_admin"
      : role;

  const isOrgAdminInvite = hasPrimary && effectiveRole === "organization_admin";
  const isPropertyAdminInvite =
    isPropertyScope || (hasPrimary && effectiveRole === "property_administrator");
  const isOrgWideInvite = !isPropertyScope && (!hasPrimary || isOrgAdminInvite);

  const resolvedPropertyIds = isOrgWideInvite
    ? defaultPropertyId != null
      ? [defaultPropertyId]
      : propertyId
        ? [Number.parseInt(propertyId, 10)]
        : []
    : lockedPropertyId != null
      ? [lockedPropertyId]
      : propertyId
        ? [Number.parseInt(propertyId, 10)]
        : [];

  const canSubmit =
    resolvedPropertyIds.length > 0 &&
    (!isPropertyAdminInvite || resolvedPropertyIds.length === 1);

  const jobTitleSuggestions = useMemo(
    () =>
      isPropertyScope || isPropertyAdminInvite
        ? PROPERTY_ADMIN_JOB_TITLE_SUGGESTIONS
        : ORGANIZATION_ADMIN_JOB_TITLE_SUGGESTIONS,
    [isPropertyScope, isPropertyAdminInvite]
  );

  const roleOptions = isPropertyScope
    ? ADMINISTRATOR_INVITE_ROLES.filter(
        (option) => option.value === "property_administrator"
      )
    : ADMINISTRATOR_INVITE_ROLES.filter(
        (option) => option.value === "organization_admin"
      );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      onError(
        isPropertyAdminInvite
          ? "Select exactly one property."
          : "Select a default landing property."
      );
      return;
    }

    setSubmitting(true);
    onError("");

    const response = await adminFetch(
      `/api/admin/organizations/${organization.id}/invitations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: effectiveRole,
          propertyIds: resolvedPropertyIds,
          propertyId: resolvedPropertyIds[0],
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          jobTitle: jobTitle.trim(),
        }),
      }
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      onError(body?.error ?? `Invitation failed (${response.status})`);
      setSubmitting(false);
      return;
    }

    const invitation = (await response.json()) as AdminOrganizationInvitation;
    onInvitationCreated(invitation);
    onSuccess?.("Invitation sent successfully.");
    setFirstName("");
    setLastName("");
    setEmail("");
    setJobTitle("");
    setSubmitting(false);
  }

  const sectionTitle = isPropertyScope
    ? "Invite Property Administrator"
    : "Invite Administrator";

  return (
    <section className="admin-portal__card">
      <h3 className="admin-portal__section-title">{sectionTitle}</h3>
      <p className="admin-portal__muted">
        {isPropertyScope
          ? "Invites a General Manager or other property-scoped administrator for this property only."
          : hasPrimary
            ? "Sends a Supabase invitation email for an organization-wide administrator. Property General Managers are invited from each property page."
            : "The first administrator becomes the Primary Owner for this organization. They sign in with their real email address and complete first-login setup."}
      </p>

      <form className="admin-portal__form" onSubmit={handleSubmit}>
        {isPropertyScope ? (
          <div className="admin-portal__field">
            <span>Role</span>
            <p className="admin-portal__static-value">Property Administrator</p>
            <span className="admin-portal__muted">
              Scope is limited to this property. Job title is descriptive only.
            </span>
          </div>
        ) : hasPrimary ? (
          <label className="admin-portal__field">
            <span>Role</span>
            <select
              value={role}
              onChange={(event) => {
                const next = event.target.value as AdministratorInviteRole;
                setRole(next);
              }}
              disabled={roleOptions.length <= 1}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="admin-portal__muted">
              {roleOptions.find((option) => option.value === role)?.description}
            </span>
          </label>
        ) : (
          <div className="admin-portal__field">
            <span>Role</span>
            <p className="admin-portal__static-value">Primary Owner</p>
            <span className="admin-portal__muted">
              Assigned automatically to the first administrator for this organization.
            </span>
          </div>
        )}

        <div className="admin-portal__field">
          <span>Scope</span>
          <p className="admin-portal__static-value">
            {isOrgWideInvite ? "Entire organization" : "Single property"}
          </p>
          <span className="admin-portal__muted">
            {isOrgWideInvite
              ? "Includes every current property and any properties added later."
              : "Limited to the single property chosen below."}
          </span>
        </div>

        {isOrgWideInvite ? (
          <div className="admin-portal__field">
            <span>Properties</span>
            <p className="admin-portal__static-value">All properties</p>
            {organization.properties.length > 1 ? (
              <label className="admin-portal__field">
                <span>Default landing property</span>
                <select
                  value={propertyId}
                  onChange={(event) => setPropertyId(event.target.value)}
                  required
                  disabled={submitting}
                >
                  <option value="">Select landing property</option>
                  {organization.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
                <span className="admin-portal__muted">
                  Org-wide administrators access all properties. This only sets
                  where they land after login.
                </span>
              </label>
            ) : null}
          </div>
        ) : lockedPropertyId != null ? (
          <div className="admin-portal__field">
            <span>Property</span>
            <p className="admin-portal__static-value">
              {organization.properties.find((row) => row.id === lockedPropertyId)
                ?.name ?? `Property #${lockedPropertyId}`}
            </p>
            <span className="admin-portal__muted">
              This administrator will only have access to this property.
            </span>
          </div>
        ) : (
          <label className="admin-portal__field">
            <span>Property</span>
            <select
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              required
              disabled={submitting}
            >
              <option value="">Select property</option>
              {organization.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
            <span className="admin-portal__muted">
              This administrator will only have access to this property.
            </span>
          </label>
        )}

        <label className="admin-portal__field">
          <span>First name</span>
          <input
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
        </label>

        <label className="admin-portal__field">
          <span>Last name</span>
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
          />
        </label>

        <label className="admin-portal__field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="admin-portal__field">
          <span>Job title (optional)</span>
          <input
            type="text"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            list="admin-job-title-suggestions"
            placeholder={
              isPropertyScope ? "General Manager" : "Corporate Administrator"
            }
            maxLength={80}
          />
          <datalist id="admin-job-title-suggestions">
            {jobTitleSuggestions.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
          <span className="admin-portal__muted">
            Descriptive only — access is set by role and permissions. Defaults to
            &ldquo;Administrator&rdquo; if left blank.
          </span>
        </label>

        <div className="admin-portal__form-actions">
          <button
            type="submit"
            className="admin-portal__button admin-portal__button--primary"
            disabled={submitting || !canSubmit}
          >
            {submitting ? "Sending invitation…" : "Invite Administrator"}
          </button>
        </div>
      </form>
    </section>
  );
}

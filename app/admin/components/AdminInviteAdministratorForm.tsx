"use client";

import { FormEvent, useId, useMemo, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import { useAdministrationApi } from "@/app/components/administration/administration-context";
import {
  ORGANIZATION_ADMIN_JOB_TITLE_SUGGESTIONS,
  PROPERTY_ADMIN_JOB_TITLE_SUGGESTIONS,
  inviteRoleFromAccessScope,
  type AdministratorAccessScope,
  type AdministratorInviteRole,
} from "@/app/lib/platform-admin/roles";
import type {
  AdminOrganizationDetail,
  AdminOrganizationInvitation,
} from "@/app/lib/platform-admin/types";
import AdminPropertyMultiSelect from "./AdminPropertyMultiSelect";

type AdminInviteAdministratorFormProps = {
  organization: AdminOrganizationDetail;
  /** organization = Corporate Leadership; property = Property Leadership. */
  scope?: "organization" | "property";
  lockedPropertyId?: number;
  /** When true, render only the form (no section card) for use inside a modal. */
  embedded?: boolean;
  onInvitationCreated: (invitation: AdminOrganizationInvitation) => void;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
  /** Optional cancel control when embedded in a modal. */
  onCancel?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
};

export default function AdminInviteAdministratorForm({
  organization,
  scope = "organization",
  lockedPropertyId,
  embedded = false,
  onInvitationCreated,
  onError,
  onSuccess,
  onCancel,
  onSubmittingChange,
}: AdminInviteAdministratorFormProps) {
  const { basePath } = useAdministrationApi();
  const isPropertyScope = scope === "property";
  const fieldListId = useId();

  const hasPrimary = organization.invitations.some(
    (invitation) =>
      invitation.isPrimary &&
      (invitation.status === "pending" || invitation.status === "accepted")
  );

  const defaultPropertyId =
    lockedPropertyId ??
    (organization.properties.length === 1 ? organization.properties[0].id : null);

  const [accessScope, setAccessScope] =
    useState<AdministratorAccessScope>("entire_organization");
  const [landingPropertyId, setLandingPropertyId] = useState(
    defaultPropertyId != null ? String(defaultPropertyId) : ""
  );
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>(
    lockedPropertyId != null ? [lockedPropertyId] : []
  );
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState(
    isPropertyScope ? "General Manager" : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const effectiveAccessScope: AdministratorAccessScope = isPropertyScope
    ? "selected_properties"
    : !hasPrimary
      ? "entire_organization"
      : accessScope;

  const effectiveRole: AdministratorInviteRole = inviteRoleFromAccessScope(
    effectiveAccessScope
  );

  const isEntireOrganization = effectiveAccessScope === "entire_organization";

  const resolvedPropertyIds = isPropertyScope
    ? lockedPropertyId != null
      ? [lockedPropertyId]
      : []
    : isEntireOrganization
      ? defaultPropertyId != null
        ? [defaultPropertyId]
        : landingPropertyId
          ? [Number.parseInt(landingPropertyId, 10)]
          : []
      : selectedPropertyIds;

  const canSubmit = resolvedPropertyIds.length > 0 && !submitting;

  const jobTitleSuggestions = useMemo(
    () =>
      isPropertyScope
        ? PROPERTY_ADMIN_JOB_TITLE_SUGGESTIONS
        : ORGANIZATION_ADMIN_JOB_TITLE_SUGGESTIONS,
    [isPropertyScope]
  );

  function reportError(message: string) {
    setLocalError(message);
    onError(message);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (!canSubmit) {
      reportError(
        isEntireOrganization
          ? "Select a default landing property."
          : "Select at least one property."
      );
      return;
    }

    setSubmitting(true);
    onSubmittingChange?.(true);
    setLocalError(null);
    onError("");

    const response = await adminFetch(
      `${basePath}/organizations/${organization.id}/invitations`,
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
      // Keep entered values after a failed submission.
      reportError(body?.error ?? `Invitation failed (${response.status})`);
      setSubmitting(false);
      onSubmittingChange?.(false);
      return;
    }

    const invitation = (await response.json()) as AdminOrganizationInvitation;
    onInvitationCreated(invitation);
    onSuccess?.("Invitation sent successfully.");
    setFirstName("");
    setLastName("");
    setEmail("");
    setJobTitle(isPropertyScope ? "General Manager" : "");
    if (!isPropertyScope && !isEntireOrganization) {
      setSelectedPropertyIds([]);
    }
    setLocalError(null);
    setSubmitting(false);
    onSubmittingChange?.(false);
  }

  const submitLabel = isPropertyScope
    ? "Send invitation"
    : "Send invitation";

  const formBody = (
    <>
      {!embedded ? (
        <p className="admin-portal__muted">
          {isPropertyScope
            ? "Invite leadership assigned only to this hotel — for example a General Manager, Assistant GM, or department head."
            : hasPrimary
              ? "Invite corporate or regional leadership for this organization. Job title is descriptive; Access Scope controls which hotels they can reach."
              : "The first leader becomes the Primary Owner for this organization. They sign in with their real email address and complete first-login setup."}
        </p>
      ) : (
        <p className="admin-portal__muted">
          {isPropertyScope
            ? "Invite leadership assigned only to this hotel. Authorization remains Property Administrator."
            : hasPrimary
              ? "Job title is descriptive. Access Scope controls hotel reach. Authorization remains Organization Administrator."
              : "The first leader becomes the Primary Owner for this organization."}
        </p>
      )}

      {localError ? (
        <p className="admin-portal__confirm-warning">{localError}</p>
      ) : null}

      <form className="admin-portal__form" onSubmit={(event) => void handleSubmit(event)}>
        {isPropertyScope ? (
          <div className="admin-portal__field">
            <span>Authorization</span>
            <p className="admin-portal__static-value">Property Administrator</p>
            <span className="admin-portal__muted">
              Internal authorization for this hotel. Job title below is the visible
              leadership title, not the authorization role.
            </span>
          </div>
        ) : hasPrimary ? (
          <div className="admin-portal__field">
            <span>Authorization</span>
            <p className="admin-portal__static-value">Organization Administrator</p>
            <span className="admin-portal__muted">
              Internal authorization for corporate leadership. Job title is
              descriptive only and is not the authorization role.
            </span>
          </div>
        ) : (
          <div className="admin-portal__field">
            <span>Authorization</span>
            <p className="admin-portal__static-value">Primary Owner</p>
            <span className="admin-portal__muted">
              Assigned automatically to the first leader for this organization.
            </span>
          </div>
        )}

        {isPropertyScope ? (
          <div className="admin-portal__field">
            <span>Access Scope</span>
            <p className="admin-portal__static-value">This property only</p>
          </div>
        ) : hasPrimary ? (
          <fieldset className="admin-portal__field">
            <legend>Access Scope</legend>
            <div className="admin-portal__checkbox-grid">
              <label className="admin-portal__checkbox-field">
                <input
                  type="radio"
                  name={`access-scope-${fieldListId}`}
                  checked={accessScope === "entire_organization"}
                  onChange={() => setAccessScope("entire_organization")}
                  disabled={submitting}
                />
                <span>
                  <strong>Entire Organization</strong>
                  <br />
                  <span className="admin-portal__muted">
                    Every current hotel and any properties added later.
                  </span>
                </span>
              </label>
              <label className="admin-portal__checkbox-field">
                <input
                  type="radio"
                  name={`access-scope-${fieldListId}`}
                  checked={accessScope === "selected_properties"}
                  onChange={() => setAccessScope("selected_properties")}
                  disabled={submitting}
                />
                <span>
                  <strong>Selected Properties</strong>
                  <br />
                  <span className="admin-portal__muted">
                    Only the hotels you assign — typical for Regional Directors
                    and Area Managers.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>
        ) : (
          <div className="admin-portal__field">
            <span>Access Scope</span>
            <p className="admin-portal__static-value">Entire Organization</p>
            <span className="admin-portal__muted">
              Includes every current property and any properties added later.
            </span>
          </div>
        )}

        {isPropertyScope && lockedPropertyId != null ? (
          <div className="admin-portal__field">
            <span>Property</span>
            <p className="admin-portal__static-value">
              {organization.properties.find((row) => row.id === lockedPropertyId)
                ?.name ?? `Property #${lockedPropertyId}`}
            </p>
          </div>
        ) : null}

        {!isPropertyScope && isEntireOrganization ? (
          <div className="admin-portal__field">
            <span>Properties</span>
            <p className="admin-portal__static-value">All properties</p>
            {organization.properties.length > 1 ? (
              <label className="admin-portal__field">
                <span>Default landing property</span>
                <select
                  value={landingPropertyId}
                  onChange={(event) => setLandingPropertyId(event.target.value)}
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
                  They can switch among all organization properties. This only
                  sets where they land after login.
                </span>
              </label>
            ) : null}
          </div>
        ) : null}

        {!isPropertyScope && hasPrimary && !isEntireOrganization ? (
          <div className="admin-portal__field">
            <span>Selected properties</span>
            <AdminPropertyMultiSelect
              properties={organization.properties}
              value={selectedPropertyIds}
              onChange={setSelectedPropertyIds}
              disabled={submitting}
            />
            <span className="admin-portal__muted">
              Search and select the hotels this leader oversees.
            </span>
          </div>
        ) : null}

        <label className="admin-portal__field">
          <span>First name</span>
          <input
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
            disabled={submitting}
            autoFocus={embedded}
          />
        </label>

        <label className="admin-portal__field">
          <span>Last name</span>
          <input
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
            disabled={submitting}
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
            disabled={submitting}
          />
        </label>

        <label className="admin-portal__field">
          <span>Job title</span>
          <input
            type="text"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            list={fieldListId}
            placeholder={
              isPropertyScope ? "General Manager" : "Corporate Administrator"
            }
            maxLength={80}
            required={isPropertyScope}
            disabled={submitting}
          />
          <datalist id={fieldListId}>
            {jobTitleSuggestions.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
          <span className="admin-portal__muted">
            {isPropertyScope
              ? "Visible leadership title for this hotel (defaults to General Manager). Not the authorization role."
              : "Descriptive title such as Corporate Administrator, Regional Director, or Area Manager. Not the authorization role."}
          </span>
        </label>

        <div className="admin-portal__form-actions">
          {onCancel ? (
            <button
              type="button"
              className="admin-portal__button"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            className="admin-portal__button admin-portal__button--primary"
            disabled={!canSubmit}
          >
            {submitting ? "Sending invitation…" : submitLabel}
          </button>
        </div>
      </form>
    </>
  );

  if (embedded) {
    return formBody;
  }

  return (
    <section className="admin-portal__card">
      <h3 className="admin-portal__section-title">
        {isPropertyScope ? "Invite Property Leader" : "Invite Organization Leader"}
      </h3>
      {formBody}
    </section>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type {
  AdminOrganizationDetail,
  AdminOrganizationInvitation,
} from "@/app/lib/platform-admin/types";
import {
  ADMINISTRATOR_INVITE_ROLES,
  type AdministratorInviteRole,
} from "@/app/lib/platform-admin/roles";

type AdminInviteAdministratorFormProps = {
  organization: AdminOrganizationDetail;
  onInvitationCreated: (invitation: AdminOrganizationInvitation) => void;
  onError: (message: string) => void;
};

export default function AdminInviteAdministratorForm({
  organization,
  onInvitationCreated,
  onError,
}: AdminInviteAdministratorFormProps) {
  const hasPrimary = organization.invitations.some(
    (invitation) =>
      invitation.isPrimary &&
      (invitation.status === "pending" || invitation.status === "accepted")
  );

  const defaultPropertyId =
    organization.properties.length === 1 ? String(organization.properties[0].id) : "";

  const [role, setRole] = useState<AdministratorInviteRole>("organization_admin");
  const [propertyId, setPropertyId] = useState(defaultPropertyId);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const propertyLabel =
    role === "property_administrator" ? "Property" : "Home property";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    onError("");

    const response = await adminFetch(
      `/api/admin/organizations/${organization.id}/invitations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          propertyId: Number.parseInt(propertyId, 10),
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
    setFirstName("");
    setLastName("");
    setEmail("");
    setJobTitle("");
    setSubmitting(false);
  }

  return (
    <section className="admin-portal__card">
      <h3 className="admin-portal__section-title">Invite Administrator</h3>
      <p className="admin-portal__muted">
        {hasPrimary
          ? "Sends a Supabase invitation email. Additional administrators can be invited at any time — no new organization required."
          : "The first administrator becomes the Primary Owner for this organization. They sign in with their real email address and complete first-login setup."}
      </p>

      <form className="admin-portal__form" onSubmit={handleSubmit}>
        {hasPrimary ? (
          <label className="admin-portal__field">
            <span>Role</span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AdministratorInviteRole)}
            >
              {ADMINISTRATOR_INVITE_ROLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="admin-portal__muted">
              {ADMINISTRATOR_INVITE_ROLES.find((option) => option.value === role)?.description}
            </span>
          </label>
        ) : null}

        <label className="admin-portal__field">
          <span>{propertyLabel}</span>
          <select
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
            required
          >
            <option value="">Select property</option>
            {organization.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>

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
            placeholder="Administrator"
            maxLength={80}
          />
          <datalist id="admin-job-title-suggestions">
            <option value="General Manager" />
            <option value="Assistant General Manager" />
            <option value="Area General Manager" />
            <option value="Regional Director" />
            <option value="Corporate Administrator" />
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
            disabled={submitting || !propertyId}
          >
            {submitting ? "Sending invitation…" : "Invite Administrator"}
          </button>
        </div>
      </form>
    </section>
  );
}

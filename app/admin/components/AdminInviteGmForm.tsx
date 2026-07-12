"use client";

import { FormEvent, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type {
  AdminOrganizationDetail,
  AdminOrganizationInvitation,
} from "@/app/lib/platform-admin/types";
import AdminErrorState from "./AdminErrorState";

type AdminInviteGmFormProps = {
  organization: AdminOrganizationDetail;
  onInvitationCreated: (invitation: AdminOrganizationInvitation) => void;
  onError: (message: string) => void;
};

export default function AdminInviteGmForm({
  organization,
  onInvitationCreated,
  onError,
}: AdminInviteGmFormProps) {
  const defaultPropertyId =
    organization.properties.length === 1 ? String(organization.properties[0].id) : "";

  const [propertyId, setPropertyId] = useState(defaultPropertyId);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    onError("");

    const response = await adminFetch(`/api/admin/organizations/${organization.id}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: Number.parseInt(propertyId, 10),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      }),
    });

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
    setSubmitting(false);
  }

  return (
    <section className="admin-portal__card">
      <h3 className="admin-portal__section-title">Invite first GM</h3>
      <p className="admin-portal__muted">
        Sends a Supabase invitation email. The GM signs in with their real email address and
        receives organization owner access for the selected property.
      </p>

      <form className="admin-portal__form" onSubmit={handleSubmit}>
        {organization.properties.length > 1 ? (
          <label className="admin-portal__field">
            <span>Property</span>
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
        ) : null}

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

        <div className="admin-portal__form-actions">
          <button
            type="submit"
            className="admin-portal__button admin-portal__button--primary"
            disabled={submitting || !propertyId}
          >
            {submitting ? "Sending invitation…" : "Send GM invitation"}
          </button>
        </div>
      </form>
    </section>
  );
}

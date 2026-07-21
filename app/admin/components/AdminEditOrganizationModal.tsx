"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import { useAdministrationApi } from "@/app/components/administration/administration-context";
import type { AdminOrganizationDetail } from "@/app/lib/platform-admin/types";
import AdminModalFrame from "./AdminModalFrame";

type AdminEditOrganizationModalProps = {
  open: boolean;
  organization: AdminOrganizationDetail | null;
  onClose: () => void;
  onSaved: (organization: AdminOrganizationDetail, message: string) => void;
  onError: (message: string) => void;
};

export default function AdminEditOrganizationModal({
  open,
  organization,
  onClose,
  onSaved,
  onError,
}: AdminEditOrganizationModalProps) {
  const { basePath, capabilities } = useAdministrationApi();
  // Null capabilities = platform default context (legal identity editable; the
  // server still enforces platform_owner). Customer portal passes an explicit
  // capability set with canEditLegalIdentity = false.
  const canEditLegal = capabilities ? capabilities.canEditLegalIdentity : true;

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !organization) return;
    setName(organization.name);
    setLegalName(organization.legalName ?? "");
    setContactEmail(organization.contactEmail ?? "");
    setContactPhone(organization.contactPhone ?? "");
    setBusinessAddress(organization.businessAddress ?? "");
    setContactName(organization.contactName ?? "");
    setLocalError(null);
  }, [open, organization]);

  const dirty = useMemo(() => {
    if (!organization) return false;
    const changed =
      name.trim() !== organization.name ||
      contactEmail.trim() !== (organization.contactEmail ?? "") ||
      contactPhone.trim() !== (organization.contactPhone ?? "") ||
      businessAddress.trim() !== (organization.businessAddress ?? "") ||
      contactName.trim() !== (organization.contactName ?? "");
    if (changed) return true;
    if (canEditLegal && legalName.trim() !== (organization.legalName ?? "")) {
      return true;
    }
    return false;
  }, [
    organization,
    name,
    legalName,
    contactEmail,
    contactPhone,
    businessAddress,
    contactName,
    canEditLegal,
  ]);

  if (!open || !organization) {
    return null;
  }

  const currentOrganization = organization;

  function requestClose() {
    if (submitting) return;
    if (dirty && !window.confirm("You have unsaved changes. Close without saving?")) {
      return;
    }
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setLocalError("Organization name is required");
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    onError("");

    const payload: Record<string, unknown> = {
      name: name.trim(),
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      businessAddress: businessAddress.trim() || null,
      contactName: contactName.trim() || null,
    };
    if (canEditLegal) {
      payload.legalName = legalName.trim() || null;
    }

    const response = await adminFetch(
      `${basePath}/organizations/${currentOrganization.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    setSubmitting(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      const message = body?.error ?? `Save failed (${response.status})`;
      setLocalError(message);
      onError(message);
      return;
    }

    const body = (await response.json()) as AdminOrganizationDetail;
    onSaved(body, "Organization saved successfully.");
  }

  return (
    <AdminModalFrame
      open={open}
      title="Edit Organization"
      titleId="admin-edit-organization-title"
      lockClose={submitting}
      closeOnBackdrop={!submitting}
      onClose={requestClose}
    >
      <p className="admin-portal__muted">
        Update the organization&apos;s operational profile. Legal identity, slug,
        and status are managed by One Eyrie.
      </p>

      {localError ? (
        <p className="admin-portal__confirm-warning">{localError}</p>
      ) : null}

      <form className="admin-portal__form" onSubmit={handleSubmit}>
        <label className="admin-portal__field">
          <span>Display name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            disabled={submitting}
            autoFocus
          />
          <span className="admin-portal__muted">
            The name shown throughout the app.
          </span>
        </label>

        {canEditLegal ? (
          <label className="admin-portal__field">
            <span>Legal / company name</span>
            <input
              type="text"
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              maxLength={200}
              disabled={submitting}
              placeholder="Registered legal entity name"
            />
            <span className="admin-portal__muted">
              One Eyrie only — used for billing, contracts, and licensing.
            </span>
          </label>
        ) : (
          <div className="admin-portal__field">
            <span>Legal / company name</span>
            <p className="admin-portal__static-value">
              {organization.legalName || organization.name}
            </p>
            <span className="admin-portal__muted">
              Managed by One Eyrie to preserve billing and contract integrity.
            </span>
          </div>
        )}

        <label className="admin-portal__field">
          <span>Contact email</span>
          <input
            type="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            maxLength={254}
            disabled={submitting}
            placeholder="operations@example.com"
          />
        </label>

        <label className="admin-portal__field">
          <span>Contact phone</span>
          <input
            type="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            maxLength={40}
            disabled={submitting}
          />
        </label>

        <label className="admin-portal__field">
          <span>Contact person</span>
          <input
            type="text"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            maxLength={120}
            disabled={submitting}
            placeholder="Operations contact name"
          />
        </label>

        <label className="admin-portal__field">
          <span>Mailing / business address</span>
          <textarea
            value={businessAddress}
            onChange={(event) => setBusinessAddress(event.target.value)}
            maxLength={500}
            rows={3}
            disabled={submitting}
          />
        </label>

        <div className="admin-portal__field">
          <span>Slug</span>
          <p className="admin-portal__static-value">{organization.slug}</p>
          <span className="admin-portal__muted">
            Internal identifier — managed by One Eyrie.
          </span>
        </div>
        <div className="admin-portal__field">
          <span>Status</span>
          <p className="admin-portal__static-value">{organization.status}</p>
          <span className="admin-portal__muted">
            Use Suspend / Reactivate for status changes.
          </span>
        </div>

        <div className="admin-portal__form-actions">
          <button
            type="button"
            className="admin-portal__button"
            onClick={requestClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="admin-portal__button admin-portal__button--primary"
            disabled={submitting || !dirty}
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </AdminModalFrame>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
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
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !organization) return;
    setName(organization.name);
    setLocalError(null);
  }, [open, organization]);

  if (!open || !organization) {
    return null;
  }

  const currentOrganization = organization;
  const dirty = name.trim() !== currentOrganization.name;

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

    const response = await adminFetch(
      `/api/admin/organizations/${currentOrganization.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
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
        Update organization profile fields supported by the current schema.
        Suspend / reactivate remain separate protected actions.
      </p>

      {localError ? (
        <p className="admin-portal__confirm-warning">{localError}</p>
      ) : null}

      <form className="admin-portal__form" onSubmit={handleSubmit}>
        <label className="admin-portal__field">
          <span>Organization name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            disabled={submitting}
            autoFocus
          />
        </label>
        <div className="admin-portal__field">
          <span>Slug</span>
          <p className="admin-portal__static-value">{organization.slug}</p>
          <span className="admin-portal__muted">
            Slug updates automatically when the name changes (if available).
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

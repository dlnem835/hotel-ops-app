"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AdminOrganizationInvitation } from "@/app/lib/platform-admin/types";
import AdminModalFrame from "./AdminModalFrame";

type AdminChangeEmailModalProps = {
  open: boolean;
  invitation: AdminOrganizationInvitation | null;
  submitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (newEmail: string) => void;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminChangeEmailModal({
  open,
  invitation,
  submitting = false,
  error = null,
  onCancel,
  onConfirm,
}: AdminChangeEmailModalProps) {
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [step, setStep] = useState<"edit" | "confirm">("edit");

  useEffect(() => {
    if (!open) return;
    setNewEmail("");
    setConfirmEmail("");
    setStep("edit");
  }, [open, invitation?.id]);

  if (!open || !invitation) {
    return null;
  }

  const normalizedNew = newEmail.trim().toLowerCase();
  const normalizedConfirm = confirmEmail.trim().toLowerCase();
  const currentEmail = invitation.email.trim().toLowerCase();
  const emailValid = EMAIL_PATTERN.test(normalizedNew);
  const emailChanged = normalizedNew !== currentEmail;
  const emailsMatch = normalizedNew === normalizedConfirm;
  const canContinue = emailValid && emailChanged && emailsMatch && !submitting;
  const canSubmit = emailValid && emailChanged && emailsMatch && !submitting;

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue) return;
    setStep("confirm");
  }

  function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    onConfirm(normalizedNew);
  }

  return (
    <AdminModalFrame
      open={open}
      title="Change email"
      titleId="admin-change-email-title"
      lockClose={submitting}
      closeOnBackdrop={!submitting}
      onClose={onCancel}
    >
      <p className="admin-portal__muted">
        Platform Owner testing helper. Updates Supabase Auth and synced
        invitation/team records for{" "}
        <strong>
          {invitation.firstName} {invitation.lastName}
        </strong>
        . Roles, memberships, invitations history, and permissions are preserved.
      </p>

      <dl className="admin-portal__confirm-details">
        <div className="admin-portal__confirm-details-row">
          <dt>Current email</dt>
          <dd>{invitation.email}</dd>
        </div>
        {step === "confirm" ? (
          <div className="admin-portal__confirm-details-row">
            <dt>New email</dt>
            <dd>{normalizedNew}</dd>
          </div>
        ) : null}
      </dl>

      {error ? <p className="admin-portal__confirm-warning">{error}</p> : null}

      {step === "edit" ? (
        <form className="admin-portal__form" onSubmit={handleContinue}>
          <label className="admin-portal__field">
            <span>New email</span>
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              autoComplete="off"
              autoFocus
              required
              disabled={submitting}
            />
          </label>
          <label className="admin-portal__field">
            <span>Confirm new email</span>
            <input
              type="email"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              autoComplete="off"
              required
              disabled={submitting}
            />
          </label>
          {confirmEmail && !emailsMatch ? (
            <p className="admin-portal__confirm-warning">Emails do not match.</p>
          ) : null}
          <div className="admin-portal__form-actions">
            <button
              type="button"
              className="admin-portal__button"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-portal__button admin-portal__button--primary"
              disabled={!canContinue}
            >
              Continue
            </button>
          </div>
        </form>
      ) : (
        <form className="admin-portal__form" onSubmit={handleConfirm}>
          <p className="admin-portal__confirm-warning">
            Confirm changing this administrator&apos;s email to{" "}
            <strong>{normalizedNew}</strong>. Future invitations and password
            resets will be sent to the new address.
          </p>
          <div className="admin-portal__form-actions">
            <button
              type="button"
              className="admin-portal__button"
              onClick={() => setStep("edit")}
              disabled={submitting}
            >
              Back
            </button>
            <button
              type="button"
              className="admin-portal__button"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-portal__button admin-portal__button--primary"
              disabled={!canSubmit}
            >
              {submitting ? "Changing email…" : "Confirm change"}
            </button>
          </div>
        </form>
      )}
    </AdminModalFrame>
  );
}

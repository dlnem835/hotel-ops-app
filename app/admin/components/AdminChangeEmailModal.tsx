"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AdminOrganizationInvitation } from "@/app/lib/platform-admin/types";

type AdminChangeEmailModalProps = {
  open: boolean;
  invitation: AdminOrganizationInvitation | null;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (newEmail: string) => void;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminChangeEmailModal({
  open,
  invitation,
  submitting = false,
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
  const canContinue = emailValid && emailChanged;
  const canSubmit = canContinue && emailsMatch && !submitting;

  function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue) return;
    setStep("confirm");
  }

  function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    onConfirm(normalizedNew);
  }

  return (
    <div className="admin-portal__modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="admin-portal__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-change-email-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="admin-change-email-title" className="admin-portal__section-title">
          Change email
        </h3>
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
                disabled={!canContinue || !emailsMatch || submitting}
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
                {submitting ? "Saving…" : "Confirm change"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

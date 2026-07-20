"use client";

import { FormEvent, useEffect, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import { TRANSFER_OWNERSHIP_CONFIRM_PHRASE } from "@/app/lib/platform-admin/types";
import type {
  AdminOrganizationInvitation,
  TransferOwnershipSuccessor,
} from "@/app/lib/platform-admin/types";
import AdminModalFrame from "./AdminModalFrame";

type AdminTransferOwnershipModalProps = {
  open: boolean;
  organizationId: number;
  primaryInvitation: AdminOrganizationInvitation | null;
  onClose: () => void;
  onTransferred: (message: string) => void;
  onError: (message: string) => void;
};

export default function AdminTransferOwnershipModal({
  open,
  organizationId,
  primaryInvitation,
  onClose,
  onTransferred,
  onError,
}: AdminTransferOwnershipModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [successors, setSuccessors] = useState<TransferOwnershipSuccessor[]>([]);
  const [loadingSuccessors, setLoadingSuccessors] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !primaryInvitation) return;
    setStep(1);
    setSelectedId("");
    setConfirmPhrase("");
    setLocalError(null);
    setLoadingSuccessors(true);

    void (async () => {
      const response = await adminFetch(
        `/api/admin/organizations/${organizationId}/ownership-successors`
      );
      setLoadingSuccessors(false);
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setLocalError(body?.error ?? `Failed to load successors (${response.status})`);
        setSuccessors([]);
        return;
      }
      const body = (await response.json()) as {
        successors: TransferOwnershipSuccessor[];
      };
      setSuccessors(body.successors ?? []);
    })();
  }, [open, organizationId, primaryInvitation?.id]);

  if (!open || !primaryInvitation) {
    return null;
  }

  const currentPrimary = primaryInvitation;
  const selected = successors.find((row) => row.invitationId === selectedId) ?? null;
  const phraseMatches = confirmPhrase.trim() === TRANSFER_OWNERSHIP_CONFIRM_PHRASE;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !phraseMatches || submitting) return;

    setSubmitting(true);
    setLocalError(null);
    onError("");

    const response = await adminFetch(
      `/api/admin/organizations/${organizationId}/invitations/${currentPrimary.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer_primary_ownership",
          successorInvitationId: selected.invitationId,
          confirmPhrase: confirmPhrase.trim(),
        }),
      }
    );

    setSubmitting(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      const message = body?.error ?? `Transfer failed (${response.status})`;
      setLocalError(message);
      onError(message);
      return;
    }

    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    onTransferred(body?.message ?? "Primary ownership transferred successfully.");
  }

  return (
    <AdminModalFrame
      open={open}
      title="Transfer Primary Ownership"
      titleId="admin-transfer-ownership-title"
      wide
      lockClose={submitting}
      closeOnBackdrop={!submitting}
      onClose={onClose}
    >
      <p className="admin-portal__muted">
        Transfer Primary Owner designation to another organization-wide
        administrator. This cannot be done through Edit Administrator.
      </p>

      {localError ? (
        <p className="admin-portal__confirm-warning">{localError}</p>
      ) : null}

      {step === 1 ? (
        <div className="admin-portal__form">
          <h4 className="admin-portal__edit-section-title">Step 1 — Select successor</h4>
          {loadingSuccessors ? (
            <p className="admin-portal__muted">Loading eligible administrators…</p>
          ) : successors.length === 0 ? (
            <p className="admin-portal__muted">
              No eligible successors. Invite and activate an Organization Admin
              first, and ensure their account setup is complete.
            </p>
          ) : (
            <div className="admin-portal__checkbox-grid">
              {successors.map((row) => {
                const selectedRow = selectedId === row.invitationId;
                return (
                  <label
                    key={row.invitationId}
                    className="admin-portal__checkbox-field"
                    style={{
                      alignItems: "flex-start",
                      border: selectedRow
                        ? "1px solid #c8a96a"
                        : "1px solid #3a352e",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    <input
                      type="radio"
                      name="successor"
                      checked={selectedRow}
                      onChange={() => setSelectedId(row.invitationId)}
                      disabled={submitting}
                    />
                    <span>
                      <strong>
                        {row.firstName} {row.lastName}
                      </strong>
                      <br />
                      {row.email}
                      <br />
                      Username: {row.username?.trim() || "Not yet created"}
                      <br />
                      {row.roleLabel}
                      {row.jobTitle ? ` · ${row.jobTitle}` : ""}
                      <br />
                      Status: {row.status}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <div className="admin-portal__form-actions">
            <button
              type="button"
              className="admin-portal__button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="admin-portal__button admin-portal__button--primary"
              disabled={!selectedId || submitting}
              onClick={() => setStep(2)}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 && selected ? (
        <div className="admin-portal__form">
          <h4 className="admin-portal__edit-section-title">Step 2 — Review effects</h4>
          <dl className="admin-portal__confirm-details">
            <div className="admin-portal__confirm-details-row">
              <dt>Current Primary Owner</dt>
              <dd>
                {currentPrimary.firstName} {currentPrimary.lastName}
                <br />
                {currentPrimary.email}
              </dd>
            </div>
            <div className="admin-portal__confirm-details-row">
              <dt>New Primary Owner</dt>
              <dd>
                {selected.firstName} {selected.lastName}
                <br />
                {selected.email}
              </dd>
            </div>
          </dl>
          <ul className="admin-portal__muted" style={{ paddingLeft: 18, margin: 0 }}>
            <li>The selected administrator becomes Primary Owner.</li>
            <li>The current Primary Owner becomes Organization Administrator.</li>
            <li>Both retain organization-wide property access.</li>
            <li>Platform Owner status is separate and unchanged.</li>
            <li>Historical records and audit history are preserved.</li>
            <li>The transfer takes effect immediately.</li>
          </ul>
          <div className="admin-portal__form-actions">
            <button
              type="button"
              className="admin-portal__button"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              Back
            </button>
            <button
              type="button"
              className="admin-portal__button admin-portal__button--primary"
              disabled={submitting}
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && selected ? (
        <form className="admin-portal__form" onSubmit={handleSubmit}>
          <h4 className="admin-portal__edit-section-title">Step 3 — Confirmation</h4>
          <p className="admin-portal__confirm-warning">
            Type <strong>{TRANSFER_OWNERSHIP_CONFIRM_PHRASE}</strong> to enable
            the final action.
          </p>
          <label className="admin-portal__field">
            <span>Confirmation phrase</span>
            <input
              type="text"
              value={confirmPhrase}
              onChange={(event) => setConfirmPhrase(event.target.value)}
              autoComplete="off"
              autoFocus
              disabled={submitting}
            />
          </label>
          <div className="admin-portal__form-actions">
            <button
              type="button"
              className="admin-portal__button"
              onClick={() => setStep(2)}
              disabled={submitting}
            >
              Back
            </button>
            <button
              type="submit"
              className="admin-portal__button admin-portal__button--danger"
              disabled={!phraseMatches || submitting}
            >
              {submitting ? "Transferring…" : "Transfer Primary Ownership"}
            </button>
          </div>
        </form>
      ) : null}
    </AdminModalFrame>
  );
}

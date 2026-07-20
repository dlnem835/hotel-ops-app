"use client";

import { FormEvent } from "react";
import AdminModalFrame from "./AdminModalFrame";

type ConfirmDetail = {
  label: string;
  value: string;
};

type AdminConfirmNameModalProps = {
  open: boolean;
  title: string;
  description: string;
  /** Text the user must type exactly to enable confirm. */
  organizationName: string;
  confirmLabel: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmName: string;
  onConfirmNameChange: (value: string) => void;
  details?: ConfirmDetail[];
  warningNote?: string;
  confirmPromptLabel?: string;
  /** When true, backdrop click does not dismiss (default for destructive). */
  closeOnBackdrop?: boolean;
};

export default function AdminConfirmNameModal({
  open,
  title,
  description,
  organizationName,
  confirmLabel,
  submitting = false,
  onCancel,
  onConfirm,
  confirmName,
  onConfirmNameChange,
  details,
  warningNote,
  confirmPromptLabel,
  closeOnBackdrop = false,
}: AdminConfirmNameModalProps) {
  if (!open) {
    return null;
  }

  const nameMatches =
    confirmName.trim().toLowerCase() === organizationName.trim().toLowerCase();
  const promptLabel =
    confirmPromptLabel ?? `Type ${organizationName} to confirm`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameMatches && !submitting) {
      onConfirm();
    }
  }

  return (
    <AdminModalFrame
      open={open}
      title={title}
      titleId="admin-confirm-name-title"
      lockClose={submitting}
      closeOnBackdrop={closeOnBackdrop && !submitting}
      onClose={onCancel}
    >
      <p className="admin-portal__muted">{description}</p>

      {details && details.length > 0 ? (
        <dl className="admin-portal__confirm-details">
          {details.map((detail) => (
            <div key={detail.label} className="admin-portal__confirm-details-row">
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {warningNote ? (
        <p className="admin-portal__confirm-warning">{warningNote}</p>
      ) : null}

      <form className="admin-portal__form" onSubmit={handleSubmit}>
        <label className="admin-portal__field">
          <span>{promptLabel}</span>
          <input
            type="text"
            value={confirmName}
            onChange={(event) => onConfirmNameChange(event.target.value)}
            autoComplete="off"
            autoFocus
            disabled={submitting}
          />
        </label>

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
            className="admin-portal__button admin-portal__button--danger"
            disabled={!nameMatches || submitting}
          >
            {submitting ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </AdminModalFrame>
  );
}

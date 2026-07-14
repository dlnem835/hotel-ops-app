"use client";

import { FormEvent } from "react";

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
}: AdminConfirmNameModalProps) {
  if (!open) {
    return null;
  }

  const nameMatches = confirmName.trim() === organizationName;
  const promptLabel =
    confirmPromptLabel ?? `Type ${organizationName} to confirm`;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameMatches && !submitting) {
      onConfirm();
    }
  }

  return (
    <div className="admin-portal__modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="admin-portal__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-name-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="admin-confirm-name-title" className="admin-portal__section-title">
          {title}
        </h3>
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
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";

type AdminConfirmNameModalProps = {
  open: boolean;
  title: string;
  description: string;
  organizationName: string;
  confirmLabel: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmName: string;
  onConfirmNameChange: (value: string) => void;
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
}: AdminConfirmNameModalProps) {
  if (!open) {
    return null;
  }

  const nameMatches = confirmName.trim() === organizationName;

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

        <form className="admin-portal__form" onSubmit={handleSubmit}>
          <label className="admin-portal__field">
            <span>Type {organizationName} to confirm</span>
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
              {submitting ? "Deleting…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

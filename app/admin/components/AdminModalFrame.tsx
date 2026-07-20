"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

type AdminModalFrameProps = {
  open: boolean;
  title: string;
  titleId?: string;
  wide?: boolean;
  /** When true, Escape / backdrop / X cannot close the modal. */
  lockClose?: boolean;
  /** When false, backdrop clicks do not close (destructive modals). Default true. */
  closeOnBackdrop?: boolean;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Shared Platform Admin modal chrome: overlay, dialog, Escape, optional
 * backdrop dismiss, and an accessible X close control.
 */
export default function AdminModalFrame({
  open,
  title,
  titleId,
  wide = false,
  lockClose = false,
  closeOnBackdrop = true,
  onClose,
  children,
}: AdminModalFrameProps) {
  const autoTitleId = useId();
  const resolvedTitleId = titleId ?? autoTitleId;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    const timer = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !lockClose) {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, lockClose, onClose]);

  if (!open) {
    return null;
  }

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (lockClose || !closeOnBackdrop) return;
    onClose();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !lockClose) {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <div
      className="admin-portal__modal-overlay"
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        ref={dialogRef}
        className={`admin-portal__modal${wide ? " admin-portal__modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="admin-portal__modal-header">
          <h3 id={resolvedTitleId} className="admin-portal__section-title">
            {title}
          </h3>
          <button
            type="button"
            className="admin-portal__modal-close"
            aria-label="Close"
            onClick={() => {
              if (!lockClose) onClose();
            }}
            disabled={lockClose}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

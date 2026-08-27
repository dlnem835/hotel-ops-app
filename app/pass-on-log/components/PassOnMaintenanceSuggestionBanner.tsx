"use client";

type PassOnMaintenanceSuggestionBannerProps = {
  promptLabel: string;
  onCreateWorkOrder: () => void;
  onDismiss: () => void;
};

/**
 * Compact draft-only suggestion bubble — no AI branding, not a chat thread.
 */
export default function PassOnMaintenanceSuggestionBanner({
  promptLabel,
  onCreateWorkOrder,
  onDismiss,
}: PassOnMaintenanceSuggestionBannerProps) {
  return (
    <div className="pass-on-maintenance-suggestion" role="status" aria-live="polite">
      <div className="pass-on-maintenance-suggestion__eyebrow">
        Possible maintenance issue
      </div>
      <p className="pass-on-maintenance-suggestion__body">{promptLabel}</p>
      <div className="pass-on-maintenance-suggestion__actions">
        <button
          type="button"
          className="pass-on-maintenance-suggestion__create"
          onClick={onCreateWorkOrder}
        >
          Create Work Order
        </button>
        <span className="pass-on-maintenance-suggestion__sep" aria-hidden="true">
          |
        </span>
        <button
          type="button"
          className="pass-on-maintenance-suggestion__dismiss"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

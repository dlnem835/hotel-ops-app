"use client";

import { useMobileInspectionSession } from "@/app/mobile/inspections/session/[id]/MobileInspectionSessionProvider";

type MobileInspectionSessionFooterProps = {
  showNotes?: boolean;
};

export default function MobileInspectionSessionFooter({
  showNotes = false,
}: MobileInspectionSessionFooterProps) {
  const { saving, sessionNotes, setSessionNotes, saveProgress, completeInspection } =
    useMobileInspectionSession();

  return (
    <div className="one-eyrie-mobile-inspection-session-footer">
      {showNotes ? (
        <label className="one-eyrie-mobile-field one-eyrie-mobile-inspection-session__notes">
          <span>Session notes</span>
          <textarea
            rows={3}
            value={sessionNotes}
            onChange={(event) => setSessionNotes(event.target.value)}
          />
        </label>
      ) : null}

      <div className="one-eyrie-mobile-inspection-session-footer__actions">
        <button
          type="button"
          className="one-eyrie-mobile-btn one-eyrie-mobile-btn--gold-outline"
          disabled={saving}
          onClick={() => void saveProgress()}
        >
          Save Progress
        </button>
        <button
          type="button"
          className="one-eyrie-mobile-btn one-eyrie-mobile-inspection-complete-btn"
          disabled={saving}
          onClick={() => void completeInspection()}
        >
          {saving ? "Submitting…" : "Complete Inspection"}
        </button>
      </div>
    </div>
  );
}

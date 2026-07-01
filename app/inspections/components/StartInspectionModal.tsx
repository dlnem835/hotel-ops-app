"use client";

import { forestHoverHandlers } from "@/app/settings/lib/settings-ui-interactions";
import { FOREST } from "@/app/lib/oneEyrieColors";
import { StartInspectionForm, StartInspectionFormProps } from "./StartInspectionPanel";
import "./start-inspection-modal.css";

type StartInspectionModalProps = StartInspectionFormProps & {
  open: boolean;
  starting?: boolean;
  onClose: () => void;
  onStart: () => void;
};

export default function StartInspectionModal({
  open,
  starting = false,
  onClose,
  onStart,
  ...formProps
}: StartInspectionModalProps) {
  if (!open) return null;

  const startDisabled =
    !formProps.selectedRoomId || !formProps.selectedTemplateId || starting;

  return (
    <div className="start-inspection-modal-overlay" onClick={onClose}>
      <div
        className="start-inspection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-inspection-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="start-inspection-modal__header">
          <h2 id="start-inspection-modal-title" className="start-inspection-modal__title">
            Start Inspection
          </h2>
        </header>

        <div className="start-inspection-modal__content">
          <StartInspectionForm {...formProps} />
        </div>

        <footer className="start-inspection-modal__footer">
          <button
            type="button"
            className="start-inspection-modal__btn start-inspection-modal__btn--cancel"
            onClick={onClose}
            disabled={starting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="start-inspection-modal__btn start-inspection-modal__btn--submit"
            disabled={startDisabled}
            onClick={onStart}
            style={{
              background: FOREST.bg,
              border: `1px solid ${FOREST.border}`,
              color: FOREST.text,
              opacity: startDisabled ? 0.55 : 1,
              cursor: startDisabled ? "not-allowed" : "pointer",
            }}
            {...forestHoverHandlers(startDisabled)}
          >
            {starting ? "Starting..." : "Start Inspection"}
          </button>
        </footer>
      </div>
    </div>
  );
}

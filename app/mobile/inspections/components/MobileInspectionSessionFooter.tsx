"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMobileInspectionSession } from "@/app/mobile/inspections/session/[id]/MobileInspectionSessionProvider";

const SECTION_VALIDATION_MESSAGE =
  "Please complete all required inspection items before continuing to the next section.";

type MobileInspectionSessionFooterProps = {
  mode: "hub" | "category";
  categoryKey?: string;
};

function mobileInspectionItemElementId(categoryKey: string, itemKey: string) {
  return `mobile-inspection-item-${categoryKey}-${itemKey}`;
}

export default function MobileInspectionSessionFooter({
  mode,
  categoryKey,
}: MobileInspectionSessionFooterProps) {
  const router = useRouter();
  const {
    saving,
    sessionId,
    responses,
    saveProgress,
    completeInspection,
    getNextCategoryKey,
    validateCategorySection,
    isInspectionReadyToComplete,
  } = useMobileInspectionSession();
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    setValidationMessage(null);
  }, [responses, categoryKey]);

  async function navigateToCategory(targetKey: string | null) {
    const saved = await saveProgress();
    if (!saved) return;

    if (targetKey) {
      router.push(`/mobile/inspections/session/${sessionId}/${targetKey}`);
      return;
    }

    router.push(`/mobile/inspections/session/${sessionId}`);
  }

  async function handleNextSection() {
    if (!categoryKey) return;

    const validation = validateCategorySection(categoryKey);
    if (!validation.valid) {
      setValidationMessage(SECTION_VALIDATION_MESSAGE);

      if (validation.firstUnansweredItemKey) {
        document
          .getElementById(
            mobileInspectionItemElementId(categoryKey, validation.firstUnansweredItemKey)
          )
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      return;
    }

    setValidationMessage(null);
    await navigateToCategory(getNextCategoryKey(categoryKey));
  }

  if (mode === "category") {
    return (
      <div className="one-eyrie-mobile-inspection-session-footer">
        {validationMessage ? (
          <p
            className="one-eyrie-mobile-inspection-session-footer__validation"
            role="alert"
          >
            {validationMessage}
          </p>
        ) : null}
        <div className="one-eyrie-mobile-inspection-session-footer__actions one-eyrie-mobile-inspection-session-footer__actions--category">
          <button
            type="button"
            className="one-eyrie-mobile-btn one-eyrie-mobile-btn--gold-outline"
            disabled={saving || !categoryKey}
            onClick={() => void handleNextSection()}
          >
            Next Section
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="one-eyrie-mobile-inspection-session-footer">
      <div className="one-eyrie-mobile-inspection-session-footer__actions one-eyrie-mobile-inspection-session-footer__actions--hub">
        <button
          type="button"
          className="one-eyrie-mobile-btn one-eyrie-mobile-inspection-complete-btn"
          disabled={saving || !isInspectionReadyToComplete}
          onClick={() => void completeInspection()}
        >
          {saving ? "Submitting…" : "Complete Inspection"}
        </button>
      </div>
    </div>
  );
}

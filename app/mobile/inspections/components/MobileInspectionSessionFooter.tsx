"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMobileInspectionSession } from "@/app/mobile/inspections/session/[id]/MobileInspectionSessionProvider";
import { isGuidedInspectionTemplate } from "@/app/inspections/lib/inspection-guidance-ui";

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
    templateName,
    templateStandardKey,
    responses,
    saveProgress,
    completeInspection,
    getPreviousCategoryKey,
    getNextCategoryKey,
    validateCategorySection,
    isInspectionReadyToComplete,
  } = useMobileInspectionSession();
  const [validationState, setValidationState] = useState<{
    categoryKey: string;
    responseSnapshot: typeof responses;
    message: string;
  } | null>(null);
  const validationMessage =
    validationState &&
    validationState.categoryKey === categoryKey &&
    validationState.responseSnapshot === responses
      ? validationState.message
      : null;
  const hasGuidedInspectionUx = isGuidedInspectionTemplate(
    templateStandardKey,
    templateName
  );
  const previousCategoryKey = categoryKey ? getPreviousCategoryKey(categoryKey) : null;
  const nextCategoryKey = categoryKey ? getNextCategoryKey(categoryKey) : null;

  async function navigateToCategory(targetKey: string | null) {
    const saved = await saveProgress();
    if (!saved) return;

    if (targetKey) {
      router.push(`/mobile/inspections/session/${sessionId}/${targetKey}`);
      return;
    }

    router.push(`/mobile/inspections/session/${sessionId}`);
  }

  function validateCurrentSection(): boolean {
    if (!categoryKey) return false;

    const validation = validateCategorySection(categoryKey);
    if (!validation.valid) {
      setValidationState({
        categoryKey,
        responseSnapshot: responses,
        message: SECTION_VALIDATION_MESSAGE,
      });

      if (validation.firstUnansweredItemKey) {
        document
          .getElementById(
            mobileInspectionItemElementId(categoryKey, validation.firstUnansweredItemKey)
          )
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      return false;
    }

    setValidationState(null);
    return true;
  }

  async function handleNextSection() {
    if (!validateCurrentSection()) return;
    await navigateToCategory(nextCategoryKey);
  }

  async function handlePreviousSection() {
    if (!previousCategoryKey) return;
    setValidationState(null);
    await navigateToCategory(previousCategoryKey);
  }

  async function handleCompleteInspection() {
    if (!validateCurrentSection()) return;
    const completed = await completeInspection();
    if (completed) {
      router.push(`/mobile/inspections/session/${sessionId}`);
    }
  }

  if (mode === "category") {
    return (
      <div
        className={`one-eyrie-mobile-inspection-session-footer${
          hasGuidedInspectionUx ? " one-eyrie-mobile-inspection-session-footer--guided" : ""
        }`}
      >
        {validationMessage ? (
          <p
            className="one-eyrie-mobile-inspection-session-footer__validation"
            role="alert"
          >
            {validationMessage}
          </p>
        ) : null}
        <div
          className={`one-eyrie-mobile-inspection-session-footer__actions one-eyrie-mobile-inspection-session-footer__actions--category${
            hasGuidedInspectionUx
              ? " one-eyrie-mobile-inspection-session-footer__actions--guided"
              : ""
          }`}
        >
          {hasGuidedInspectionUx ? (
            <button
              type="button"
              className="one-eyrie-mobile-btn one-eyrie-mobile-btn--gold-outline"
              disabled={saving || !previousCategoryKey}
              onClick={() => void handlePreviousSection()}
            >
              ← Previous
            </button>
          ) : null}

          {hasGuidedInspectionUx && !nextCategoryKey ? (
            <button
              type="button"
              className="one-eyrie-mobile-btn one-eyrie-mobile-inspection-complete-btn"
              disabled={saving || !categoryKey}
              onClick={() => void handleCompleteInspection()}
            >
              {saving ? "Submitting…" : "Complete Inspection"}
            </button>
          ) : (
            <button
              type="button"
              className={`one-eyrie-mobile-btn ${
                hasGuidedInspectionUx
                  ? "one-eyrie-mobile-btn--gold"
                  : "one-eyrie-mobile-btn--gold-outline"
              }`}
              disabled={saving || !categoryKey}
              onClick={() => void handleNextSection()}
            >
              Next Section{hasGuidedInspectionUx ? " →" : ""}
            </button>
          )}
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

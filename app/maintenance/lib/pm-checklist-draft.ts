import {
  PM_DEFAULT_CATEGORY_KEY,
  PM_DEFAULT_CATEGORY_NAME,
  PmChecklist,
  PmChecklistStep,
} from "./pm-types";

function newClientId() {
  return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyChecklistStep(sortOrder = 0): PmChecklistStep {
  return {
    key: `step-${sortOrder}`,
    label: "",
    required: true,
    photoRequiredOnFail: false,
    sortOrder,
  };
}

export function emptyChecklist(): PmChecklist {
  return stepsToChecklist([emptyChecklistStep(0)]);
}

export function getFlatChecklistSteps(checklist: PmChecklist): PmChecklistStep[] {
  return normalizeChecklist(checklist)
    .categories.flatMap((category) => category.steps)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function stepsToChecklist(steps: PmChecklistStep[]): PmChecklist {
  return {
    categories: [
      {
        key: PM_DEFAULT_CATEGORY_KEY,
        name: PM_DEFAULT_CATEGORY_NAME,
        sortOrder: 0,
        steps: steps.map((step, index) => ({
          ...step,
          key: step.key || `step-${index}`,
          required: true,
          sortOrder: index,
        })),
      },
    ],
  };
}

export function normalizeChecklist(checklist: PmChecklist): PmChecklist {
  const flatSteps = (checklist.categories || []).flatMap((category, categoryIndex) =>
    (category.steps || []).map((step, stepIndex) => ({
      key: step.key || `step-${categoryIndex}-${stepIndex}`,
      label: step.label || "",
      required: true,
      photoRequiredOnFail: step.photoRequiredOnFail ?? false,
      sortOrder: step.sortOrder ?? stepIndex,
    }))
  );

  return stepsToChecklist(flatSteps);
}

export function rekeyChecklist(checklist: PmChecklist): PmChecklist {
  const steps = getFlatChecklistSteps(checklist).map((step, index) => ({
    ...step,
    key: step.key || newClientId(),
    required: true,
    sortOrder: index,
  }));

  return stepsToChecklist(steps);
}

/** @deprecated categories are internal only */
export function emptyChecklistCategory() {
  return {
    key: PM_DEFAULT_CATEGORY_KEY,
    name: PM_DEFAULT_CATEGORY_NAME,
    sortOrder: 0,
    steps: [emptyChecklistStep(0)],
  };
}

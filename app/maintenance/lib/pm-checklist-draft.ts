import {
  PmChecklist,
  PmChecklistCategory,
  PmChecklistStep,
} from "@/app/maintenance/lib/pm-types";

function newClientId() {
  return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyChecklistStep(sortOrder: number): PmChecklistStep {
  return {
    key: `step-${sortOrder}`,
    label: "",
    required: true,
    photoRequiredOnFail: false,
    sortOrder,
  };
}

export function emptyChecklistCategory(sortOrder: number): PmChecklistCategory {
  return {
    key: `category-${sortOrder}`,
    name: "",
    sortOrder,
    steps: [emptyChecklistStep(0)],
  };
}

export function emptyChecklist(): PmChecklist {
  return { categories: [emptyChecklistCategory(0)] };
}

export function normalizeChecklist(checklist: PmChecklist): PmChecklist {
  return {
    categories: (checklist.categories || []).map((category, categoryIndex) => ({
      key: category.key || `category-${categoryIndex}`,
      name: category.name || "",
      sortOrder: category.sortOrder ?? categoryIndex,
      steps: (category.steps || []).map((step, stepIndex) => ({
        key: step.key || `step-${stepIndex}`,
        label: step.label || "",
        required: step.required ?? true,
        photoRequiredOnFail: step.photoRequiredOnFail ?? false,
        sortOrder: step.sortOrder ?? stepIndex,
      })),
    })),
  };
}

export function rekeyChecklist(checklist: PmChecklist): PmChecklist {
  return {
    categories: checklist.categories.map((category, categoryIndex) => ({
      ...category,
      key: category.key || newClientId(),
      sortOrder: categoryIndex,
      steps: category.steps.map((step, stepIndex) => ({
        ...step,
        key: step.key || newClientId(),
        sortOrder: stepIndex,
      })),
    })),
  };
}

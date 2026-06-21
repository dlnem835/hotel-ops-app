import { templateMatchesDashboard } from "./program-map";
import { InspectionProgram } from "./inspection-types";

export type TemplatePickInput = {
  id: number;
  name: string;
  standard_key?: string | null;
  inspection_program: string;
};

export function resolveDefaultTemplateForDashboard(
  templates: TemplatePickInput[],
  program: "VR" | "RPM"
): number | null {
  const matching = templates.filter((template) =>
    templateMatchesDashboard(template.inspection_program as InspectionProgram, program)
  );

  if (matching.length === 0) {
    return null;
  }

  if (program === "VR") {
    const vacantReady = matching.find(
      (template) =>
        template.standard_key === "hk-vacant-ready" ||
        template.name.toLowerCase().includes("vacant ready")
    );
    if (vacantReady) {
      return vacantReady.id;
    }
  }

  if (program === "RPM") {
    const rpm = matching.find(
      (template) =>
        template.standard_key === "rpm-guest-room" ||
        template.name.toLowerCase().includes("rpm")
    );
    if (rpm) {
      return rpm.id;
    }
  }

  return matching[0]?.id ?? null;
}

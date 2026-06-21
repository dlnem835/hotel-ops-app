import { InspectionProgram } from "./inspection-types";

const STANDARD_PROGRAM_MAP: Record<string, InspectionProgram> = {
  "hk-vacant-ready": "VR",
  "hk-stayover": "STAYOVER",
  "hk-deep-clean": "DEEP_CLEAN",
  "rpm-guest-room": "RPM",
};

export function resolveInspectionProgram(input: {
  standard_key?: string | null;
  template_type?: string;
  name?: string;
}): InspectionProgram {
  if (input.standard_key && STANDARD_PROGRAM_MAP[input.standard_key]) {
    return STANDARD_PROGRAM_MAP[input.standard_key];
  }

  const name = (input.name || "").toLowerCase();
  if (name.includes("rpm") || name.includes("pm")) return "RPM";
  if (name.includes("stayover")) return "STAYOVER";
  if (name.includes("deep clean")) return "DEEP_CLEAN";
  if (name.includes("vacant")) return "VR";
  if (input.template_type === "RPM") return "RPM";
  if (input.template_type === "Safety") return "SAFETY";
  if (input.template_type === "Public Area") return "PUBLIC_AREA";

  return "CUSTOM";
}

export function programMatchesDashboard(
  sessionProgram: InspectionProgram,
  dashboardProgram: "VR" | "RPM"
): boolean {
  if (dashboardProgram === "VR") {
    return sessionProgram === "VR" || sessionProgram === "STAYOVER";
  }
  return sessionProgram === "RPM";
}

export function templateMatchesDashboard(
  templateProgram: InspectionProgram,
  dashboardProgram: "VR" | "RPM"
): boolean {
  return programMatchesDashboard(templateProgram, dashboardProgram);
}

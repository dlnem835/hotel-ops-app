import { AMBER, FLAT_RED, FOREST, ONE_EYRIE } from "@/app/lib/oneEyrieColors";

const MUTED_BLUE = {
  text: "#A8B8C9",
  border: "#4A5A6B",
  bg: "#1A1F28",
  fill: "#5A7A9A",
};

export type PmComplianceGrade = {
  label: string;
  accent: string;
  border: string;
  background: string;
  progressFill: string;
};

export function getPmComplianceGrade(percent: number): PmComplianceGrade {
  if (percent >= 90) {
    return {
      label: "Excellent",
      accent: FOREST.text,
      border: FOREST.border,
      background: FOREST.bg,
      progressFill: FOREST.border,
    };
  }

  if (percent >= 80) {
    return {
      label: "Good",
      accent: MUTED_BLUE.text,
      border: MUTED_BLUE.border,
      background: MUTED_BLUE.bg,
      progressFill: MUTED_BLUE.fill,
    };
  }

  if (percent >= 70) {
    return {
      label: "Needs Attention",
      accent: ONE_EYRIE.gold,
      border: AMBER.border,
      background: AMBER.bg,
      progressFill: ONE_EYRIE.gold,
    };
  }

  return {
    label: "Critical",
    accent: FLAT_RED.text,
    border: FLAT_RED.border,
    background: FLAT_RED.bg,
    progressFill: FLAT_RED.border,
  };
}

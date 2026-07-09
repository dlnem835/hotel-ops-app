import {
  REPORT_DATE_PRESET_LABELS,
  type ReportDatePreset,
} from "@/app/reports/lib/report-date-presets";

export function formatReportDateRangeLabel(
  preset: ReportDatePreset,
  dateStart: string,
  dateEnd: string
): string {
  if (preset === "custom") {
    if (dateStart && dateEnd) return `${dateStart} to ${dateEnd}`;
    if (dateStart) return `From ${dateStart}`;
    if (dateEnd) return `Through ${dateEnd}`;
    return "Custom";
  }

  const presetLabel = REPORT_DATE_PRESET_LABELS[preset];
  if (dateStart && dateEnd) {
    return `${presetLabel} (${dateStart} to ${dateEnd})`;
  }

  return presetLabel;
}

export function formatReportGeneratedAt(date = new Date()): string {
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildReportPdfFilename(reportName: string): string {
  const slug = reportName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "report"}.pdf`;
}

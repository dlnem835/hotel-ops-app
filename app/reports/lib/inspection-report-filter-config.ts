import type { InspectionModuleReportId } from "@/app/reports/lib/report-definitions";

export type InspectionReportFilterFieldConfig = {
  showAssociate: boolean;
  showInspector: boolean;
};

export function getInspectionReportFilterFields(
  reportId: InspectionModuleReportId
): InspectionReportFilterFieldConfig {
  switch (reportId) {
    case "associate-ranking":
      return { showAssociate: true, showInspector: true };
    case "top-failed-sections":
    case "top-failed-items":
    case "rooms-done":
      return { showAssociate: true, showInspector: true };
    case "rooms-not-done":
    case "rooms-by-inspector":
      return { showAssociate: false, showInspector: false };
    default:
      return { showAssociate: false, showInspector: true };
  }
}

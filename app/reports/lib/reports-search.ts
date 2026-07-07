import type {
  ReportCategorySection,
  ReportRowDefinition,
} from "@/app/reports/lib/report-definitions";

export function filterReportsForSearch(
  section: ReportCategorySection,
  searchQuery: string
): ReportRowDefinition[] {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return section.reports;
  }

  const sectionMatches = section.title.toLowerCase().includes(query);
  if (sectionMatches) {
    return section.reports;
  }

  return section.reports.filter((report) =>
    report.title.toLowerCase().includes(query)
  );
}

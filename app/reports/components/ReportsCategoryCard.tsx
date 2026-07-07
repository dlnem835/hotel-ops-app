"use client";

import type {
  ReportCategorySection,
  ReportRowDefinition,
} from "@/app/reports/lib/report-definitions";
import { filterReportsForSearch } from "@/app/reports/lib/reports-search";

type ReportsCategoryCardProps = {
  section: ReportCategorySection;
  searchQuery?: string;
  onReportSelect?: (report: ReportRowDefinition) => void;
};

function isInteractiveReport(report: ReportRowDefinition): boolean {
  return Boolean(
    report.enabled &&
      (report.pmReportId ||
        report.woReportId ||
        report.roomInspectionReportId ||
        report.rpmInspectionReportId ||
        report.lnfReportId ||
        report.passOnReportId)
  );
}

export default function ReportsCategoryCard({
  section,
  searchQuery = "",
  onReportSelect,
}: ReportsCategoryCardProps) {
  const visibleReports = filterReportsForSearch(section, searchQuery);

  if (visibleReports.length === 0) {
    return null;
  }

  return (
    <article className="reports-category-card" aria-labelledby={`reports-card-${section.id}`}>
      <header className="reports-category-card__header">
        <h2 id={`reports-card-${section.id}`} className="reports-category-card__title">
          {section.title}
        </h2>
      </header>

      <ul className="reports-category-card__list">
        {visibleReports.map((report) => {
          const interactive = isInteractiveReport(report) && onReportSelect;

          return (
            <li key={report.id}>
              {interactive ? (
                <button
                  type="button"
                  className="reports-category-card__link"
                  onClick={() => onReportSelect(report)}
                >
                  {report.title}
                </button>
              ) : (
                <span className="reports-category-card__link reports-category-card__link--disabled">
                  {report.title}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

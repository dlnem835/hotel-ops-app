"use client";

import { ChevronRight } from "lucide-react";
import type {
  PmReportId,
  ReportCategorySection,
  ReportRowDefinition,
} from "@/app/reports/lib/report-definitions";

type ReportsCategorySectionProps = {
  section: ReportCategorySection;
  onReportSelect?: (report: ReportRowDefinition, pmReportId: PmReportId) => void;
};

export default function ReportsCategorySection({
  section,
  onReportSelect,
}: ReportsCategorySectionProps) {
  return (
    <section className="reports-category-section" aria-labelledby={`reports-section-${section.id}`}>
      <header className="reports-category-section__header">
        <div className="reports-category-section__title-row">
          <h2 id={`reports-section-${section.id}`} className="reports-category-section__title">
            {section.title}
          </h2>
          {section.optional ? (
            <span className="reports-category-section__optional">Optional</span>
          ) : null}
        </div>
        <p className="reports-category-section__description">{section.description}</p>
      </header>

      <ul className="reports-category-section__list">
        {section.reports.map((report) => {
          const isInteractive = report.enabled && report.pmReportId && onReportSelect;

          if (isInteractive) {
            return (
              <li key={report.id}>
                <button
                  type="button"
                  className="reports-report-row reports-report-row--interactive"
                  onClick={() => onReportSelect(report, report.pmReportId!)}
                >
                  <ReportRowContent report={report} />
                  <ChevronRight size={18} className="reports-report-row__chevron" aria-hidden />
                </button>
              </li>
            );
          }

          return (
            <li key={report.id}>
              <div className="reports-report-row reports-report-row--disabled" aria-disabled="true">
                <ReportRowContent report={report} />
                <span className="reports-report-row__badge">Coming soon</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReportRowContent({ report }: { report: ReportRowDefinition }) {
  return (
    <div className="reports-report-row__content">
      <span className="reports-report-row__title">{report.title}</span>
      <span className="reports-report-row__description">{report.description}</span>
    </div>
  );
}

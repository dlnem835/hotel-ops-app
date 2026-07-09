"use client";

import { useRef, useState } from "react";
import { CalendarClock, Download, Printer } from "lucide-react";
import { NEUTRAL_BUTTON, neutralHoverHandlers } from "@/app/lib/oneEyrieButtons";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import ReportsScheduleModal from "@/app/reports/components/ReportsScheduleModal";
import { extractReportPdfTables } from "@/app/reports/lib/extract-report-print-content";
import { generateReportPdf } from "@/app/reports/lib/generate-report-pdf";
import { printReportDocument } from "@/app/reports/lib/print-report-document";
import { formatReportGeneratedAt } from "@/app/reports/lib/report-output-utils";
import type { ReportScheduleContext } from "@/app/reports/lib/report-schedule-types";

export type ReportsPrintableOutputProps = {
  reportName: string;
  propertyName: string;
  dateRangeLabel: string;
  filterLines: string[];
  scheduleContext: ReportScheduleContext;
  children: React.ReactNode;
};

const actionButtonStyle: React.CSSProperties = {
  ...NEUTRAL_BUTTON,
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  minHeight: "36px",
  padding: "0 12px",
  fontSize: "12px",
  fontWeight: 700,
};

export default function ReportsPrintableOutput({
  reportName,
  propertyName,
  dateRangeLabel,
  filterLines,
  scheduleContext,
  children,
}: ReportsPrintableOutputProps) {
  const printRootRef = useRef<HTMLDivElement>(null);
  const generatedAtLabel = formatReportGeneratedAt();
  const [scheduleOpen, setScheduleOpen] = useState(false);

  function handlePrint() {
    if (!printRootRef.current) return;
    printReportDocument({
      contentRoot: printRootRef.current,
      reportName,
    });
  }

  function handleDownloadPdf() {
    if (!printRootRef.current) return;

    const tables = extractReportPdfTables(printRootRef.current);
    generateReportPdf({
      reportName,
      propertyName,
      dateRangeLabel,
      filterLines,
      tables,
      generatedAtLabel,
    });
  }

  return (
    <>
      <div className="reports-printable-output" ref={printRootRef}>
        <div className="reports-output-actions">
          <button
            type="button"
            className="reports-output-actions__btn"
            style={actionButtonStyle}
            {...neutralHoverHandlers}
            onClick={handlePrint}
          >
            <Printer size={15} />
            Print
          </button>
          <button
            type="button"
            className="reports-output-actions__btn"
            style={actionButtonStyle}
            {...neutralHoverHandlers}
            onClick={handleDownloadPdf}
          >
            <Download size={15} />
            Download PDF
          </button>
          <button
            type="button"
            className="reports-output-actions__btn"
            style={actionButtonStyle}
            {...neutralHoverHandlers}
            onClick={() => setScheduleOpen(true)}
          >
            <CalendarClock size={15} />
            Schedule
          </button>
        </div>

        <div className="reports-printable-output__header">
          <div className="reports-printable-output__brand">
            <span className="reports-printable-output__brand-one">ONE</span>
            <span className="reports-printable-output__brand-eyrie">EYRIE</span>
          </div>
          <h3 className="reports-printable-output__title">{reportName}</h3>
          <dl className="reports-printable-output__meta">
            <div>
              <dt>Property</dt>
              <dd>{propertyName}</dd>
            </div>
            <div>
              <dt>Date range</dt>
              <dd>{dateRangeLabel}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>{generatedAtLabel}</dd>
            </div>
            {filterLines.map((line) => {
              const separatorIndex = line.indexOf(":");
              const label = separatorIndex >= 0 ? line.slice(0, separatorIndex) : "Filter";
              const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;

              return (
                <div key={line}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="reports-printable-output__body" style={{ color: ONE_EYRIE.text }}>
          {children}
        </div>
      </div>

      <ReportsScheduleModal
        open={scheduleOpen}
        context={scheduleContext}
        onClose={() => setScheduleOpen(false)}
      />
    </>
  );
}

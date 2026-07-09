import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportPdfTable } from "@/app/reports/lib/extract-report-print-content";
import { buildReportPdfFilename } from "@/app/reports/lib/report-output-utils";

export type GenerateReportPdfOptions = {
  reportName: string;
  propertyName: string;
  dateRangeLabel: string;
  filterLines: string[];
  tables: ReportPdfTable[];
  generatedAtLabel: string;
};

export function generateReportPdf(options: GenerateReportPdfOptions): void {
  const widestTable = options.tables.reduce(
    (max, table) => Math.max(max, table.headers.length),
    0
  );
  const orientation = widestTable > 6 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = 48;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(200, 169, 106);
  doc.text("ONE EYRIE", 40, cursorY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text(options.reportName, 40, (cursorY += 28));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);

  const metaLines = [
    `Property: ${options.propertyName}`,
    `Date range: ${options.dateRangeLabel}`,
    `Generated: ${options.generatedAtLabel}`,
    ...options.filterLines,
  ];

  metaLines.forEach((line) => {
    doc.text(line, 40, (cursorY += 16));
  });

  cursorY += 10;

  if (options.tables.length === 0) {
    doc.setFontSize(11);
    doc.text("No tabular results were available to export.", 40, cursorY);
    doc.save(buildReportPdfFilename(options.reportName));
    return;
  }

  options.tables.forEach((table, index) => {
    if (index > 0) {
      cursorY += 8;
    }

    if (table.title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      doc.text(table.title, 40, cursorY);
      cursorY += 14;
    }

    autoTable(doc, {
      startY: cursorY,
      head: [table.headers],
      body: table.rows,
      styles: {
        fontSize: 9,
        cellPadding: 6,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [200, 169, 106],
        textColor: [26, 24, 21],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [248, 246, 242],
      },
      margin: { left: 40, right: 40 },
      tableWidth: pageWidth - 80,
    });

    cursorY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
    cursorY += 18;
  });

  doc.save(buildReportPdfFilename(options.reportName));
}

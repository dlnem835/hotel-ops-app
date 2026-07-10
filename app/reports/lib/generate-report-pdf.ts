import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportPdfTable } from "@/app/reports/lib/extract-report-print-content";
import {
  countReportPdfRows,
  hasOnlyEmptyReportPdfMessage,
  REPORT_PDF_EMPTY_MESSAGE,
} from "@/app/reports/lib/report-pdf-table-builders";
import { buildReportPdfFilename } from "@/app/reports/lib/report-output-utils";

export type GenerateReportPdfOptions = {
  reportName: string;
  propertyName: string;
  dateRangeLabel: string;
  filterLines: string[];
  tables: ReportPdfTable[];
  generatedAtLabel: string;
};

const MARGIN_X = 36;
const MARGIN_TOP = 40;
const TABLE_BOTTOM_MARGIN = 48;

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export function generateReportPdf(options: GenerateReportPdfOptions): void {
  const doc = buildReportPdfDocument(options);
  doc.save(buildReportPdfFilename(options.reportName));
}

export function buildReportPdfBuffer(options: GenerateReportPdfOptions): Buffer {
  const doc = buildReportPdfDocument(options);
  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}

function getDocumentOrientation(tables: ReportPdfTable[]): "portrait" | "landscape" {
  const widestTable = tables.reduce(
    (max, table) => Math.max(max, table.headers.length),
    0
  );
  return widestTable > 6 ? "landscape" : "portrait";
}

function ensurePageSpace(doc: jsPDF, cursorY: number, requiredHeight = 72): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY + requiredHeight <= pageHeight - TABLE_BOTTOM_MARGIN) {
    return cursorY;
  }

  doc.addPage();
  return MARGIN_TOP;
}

function wrapPdfText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function buildReportPdfDocument(options: GenerateReportPdfOptions): jsPDF {
  const orientation = getDocumentOrientation(options.tables);
  const doc = new jsPDF({ orientation, unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_X * 2;
  let cursorY = MARGIN_TOP;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(200, 169, 106);
  doc.text("ONE EYRIE", MARGIN_X, cursorY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  cursorY += 24;
  const titleLines = wrapPdfText(doc, options.reportName, contentWidth);
  titleLines.forEach((line) => {
    doc.text(line, MARGIN_X, cursorY);
    cursorY += 20;
  });

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
    const wrapped = wrapPdfText(doc, line, contentWidth);
    wrapped.forEach((wrappedLine) => {
      cursorY += 14;
      doc.text(wrappedLine, MARGIN_X, cursorY);
    });
  });

  cursorY += 18;

  const totalRows = countReportPdfRows(options.tables);
  if (totalRows === 0 || hasOnlyEmptyReportPdfMessage(options.tables)) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(70, 70, 70);
    doc.text(REPORT_PDF_EMPTY_MESSAGE, MARGIN_X, cursorY);
    return doc;
  }

  options.tables.forEach((table, index) => {
    if (index > 0) {
      cursorY += 10;
    }

    if (table.title) {
      cursorY = ensurePageSpace(doc, cursorY, 48);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      const titleLinesForTable = wrapPdfText(doc, table.title, contentWidth);
      titleLinesForTable.forEach((line) => {
        doc.text(line, MARGIN_X, cursorY);
        cursorY += 14;
      });
      cursorY += 4;
    }

    if (table.headers.length === 0 || table.rows.length === 0) {
      return;
    }

    cursorY = ensurePageSpace(doc, cursorY, 96);

    autoTable(doc, {
      startY: cursorY,
      head: [table.headers],
      body: table.rows,
      styles: {
        fontSize: 9,
        cellPadding: 4,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        fillColor: [200, 169, 106],
        textColor: [26, 24, 21],
        fontStyle: "bold",
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [248, 246, 242],
      },
      margin: { left: MARGIN_X, right: MARGIN_X, top: MARGIN_TOP },
      tableWidth: contentWidth,
      showHead: "everyPage",
      rowPageBreak: "auto",
    });

    cursorY = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? cursorY;
    cursorY += 16;
  });

  return doc;
}

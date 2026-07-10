import {
  isTopAreasReportBody,
  normalizeTopAreasPrintBodyHtml,
} from "@/app/reports/lib/top-areas-report-export";
import {
  isTopCategoriesReportBody,
  normalizeTopCategoriesPrintBodyHtml,
} from "@/app/reports/lib/top-categories-report-export";

function getPrintOrientation(root: HTMLElement): "portrait" | "landscape" {
  let widestTable = 0;

  root.querySelectorAll(".reports-pm-results__table").forEach((table) => {
    widestTable = Math.max(
      widestTable,
      table.querySelectorAll("thead th").length
    );
  });

  return widestTable > 6 ? "landscape" : "portrait";
}
function normalizePrintBodyHtml(bodyRoot: HTMLElement): string {
  if (isTopAreasReportBody(bodyRoot)) {
    return normalizeTopAreasPrintBodyHtml(bodyRoot);
  }

  if (isTopCategoriesReportBody(bodyRoot)) {
    return normalizeTopCategoriesPrintBodyHtml(bodyRoot);
  }

  const clone = bodyRoot.cloneNode(true) as HTMLElement;

  clone.querySelectorAll("button").forEach((button) => {
    const text = (button.textContent || "").trim();
    const span = document.createElement("span");
    span.textContent = text;
    if (button.classList.contains("reports-pm-results__source-link")) {
      span.className = "reports-pm-results__source-link";
    }
    button.replaceWith(span);
  });

  clone.querySelectorAll("a").forEach((anchor) => {
    const text = (anchor.textContent || "").trim();
    const span = document.createElement("span");
    span.textContent = text;
    anchor.replaceWith(span);
  });

  return clone.innerHTML;
}

function buildReportPrintStyles(orientation: "portrait" | "landscape"): string {
  return `
    @page {
      size: letter ${orientation};
      margin: 0.5in;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1e1e1e;
      font-family: Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-print {
      width: 100%;
    }

    .report-print__header,
    .reports-printable-output__header {
      margin-bottom: 14pt;
      padding-bottom: 12pt;
      border-bottom: 1px solid #d1d5db;
      break-after: avoid;
      page-break-after: avoid;
      background: #ffffff !important;
      border-radius: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      padding-top: 0 !important;
    }

    .report-print__brand,
    .reports-printable-output__brand {
      display: flex;
      align-items: baseline;
      gap: 0.35em;
      margin: 0 0 6pt;
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    .reports-printable-output__brand-one {
      color: #c8a96a;
    }

    .reports-printable-output__brand-eyrie {
      color: #c8a96a;
    }

    .report-print__title,
    .reports-printable-output__title {
      margin: 0 0 10pt;
      font-size: 14pt;
      font-weight: 800;
      color: #1e1e1e !important;
    }

    .report-print__meta,
    .reports-printable-output__meta {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8pt 16pt;
      margin: 0;
    }

    .report-print__meta div,
    .reports-printable-output__meta div {
      min-width: 0;
    }

    .report-print__meta dt,
    .reports-printable-output__meta dt {
      margin: 0 0 2pt;
      color: #6b7280 !important;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .report-print__meta dd,
    .reports-printable-output__meta dd {
      margin: 0;
      color: #1e1e1e !important;
      font-size: 9pt;
      font-weight: 600;
    }

    .report-print__body,
    .reports-printable-output__body {
      color: #1e1e1e !important;
      background: #ffffff !important;
    }

    .reports-pm-results__lead,
    .reports-wo-results .reports-pm-results__lead {
      margin: 0 0 10pt;
      color: #4b5563;
      font-size: 9pt;
      font-style: italic;
    }

    .reports-pm-results__frequency-group {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 14pt;
    }

    .reports-pm-results__frequency-title {
      margin: 0 0 8pt;
      color: #1e1e1e;
      font-size: 10pt;
      font-weight: 800;
    }

    .reports-pm-results__progress-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .reports-pm-results__progress-item {
      break-inside: avoid;
      page-break-inside: avoid;
      margin-bottom: 8pt;
      padding: 8pt;
      border: 1px solid #e5e7eb;
      border-radius: 4pt;
      background: #ffffff;
    }

    .reports-pm-results__progress-header {
      display: flex;
      justify-content: space-between;
      gap: 12pt;
      margin-bottom: 6pt;
      font-size: 9pt;
      font-weight: 700;
    }

    .reports-pm-results__period-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4pt;
    }

    .reports-pm-results__period {
      padding: 2pt 6pt;
      border-radius: 3pt;
      font-size: 8pt;
      font-weight: 700;
    }

    .reports-pm-results__period--completed {
      background: #ecfdf5;
      color: #047857;
    }

    .reports-pm-results__period--missed {
      background: #fef2f2;
      color: #b91c1c;
    }

    .reports-pm-results__period--before-next-due {
      background: #ecfdf5;
      color: #047857;
    }

    .reports-pm-results__period--grace {
      background: #ecfdf5;
      color: #047857;
    }

    .reports-pm-results__period--late {
      background: #fffbeb;
      color: #b45309;
    }

    .reports-pm-results__period--upcoming {
      background: #f3f4f6;
      color: #6b7280;
    }

    .reports-pm-results__period--grace-window {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .reports-pm-results__progress-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8pt;
      margin-bottom: 6pt;
      font-size: 8pt;
      color: #4b5563;
    }

    .reports-pm-results__overview-summary {
      margin-top: 12pt;
      padding: 8pt;
      border: 1px solid #d1d5db;
      border-radius: 4pt;
    }

    .reports-pm-results__summary-list {
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 9pt;
    }

    .reports-pm-results__summary-list li {
      margin-bottom: 4pt;
    }

    .reports-pm-results__table-wrap,
    .reports-wo-group-list {
      break-inside: auto;
      page-break-inside: auto;
      margin-bottom: 14pt;
      border: 1px solid #d1d5db;
      border-radius: 4pt;
      overflow: hidden;
      background: #ffffff;
    }

    .reports-pm-results__table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }

    .reports-pm-results__table thead {
      display: table-header-group;
    }

    .reports-pm-results__table th {
      padding: 6pt 8pt;
      text-align: left;
      color: #1a1815;
      font-weight: 700;
      background: #c8a96a;
      border-bottom: 1px solid #b89555;
    }

    .reports-pm-results__table td {
      padding: 6pt 8pt;
      text-align: left;
      color: #1e1e1e;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }

    .reports-pm-results__table tbody tr:nth-child(even) td {
      background: #f8f6f2;
    }

    .reports-pm-results__table tbody tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .reports-pm-results__source-link {
      color: #1e1e1e;
      text-decoration: none;
      font-weight: 600;
    }

    .reports-all-work-orders__sort-btn,
    .reports-all-work-orders__title-link,
    .reports-wo-top-categories__row,
    .reports-wo-top-categories__title-link,
    .reports-wo-top-areas__row,
    .reports-wo-top-areas__title-link {
      border: none;
      background: transparent;
      padding: 0;
      color: #1e1e1e;
      font: inherit;
      font-weight: inherit;
      text-decoration: none;
      cursor: default;
    }

    .reports-all-work-orders__sort-icon,
    .reports-wo-top-categories__chevron,
    .reports-wo-top-areas__chevron {
      color: #1e1e1e;
    }

    .reports-wo-group-row,
    .reports-wo-summary-card {
      display: flex;
      justify-content: space-between;
      gap: 12pt;
      padding: 8pt 10pt;
      border-bottom: 1px solid #e5e7eb;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .reports-wo-group-row:last-child,
    .reports-wo-summary-card:last-child {
      border-bottom: none;
    }

    .reports-wo-group-row__label,
    .reports-wo-summary-card__label {
      color: #1e1e1e;
      font-weight: 600;
    }

    .reports-wo-group-row__count,
    .reports-wo-summary-card__value {
      color: #1e1e1e;
      font-weight: 700;
    }

    .reports-wo-results__table-wrap--wide .reports-pm-results__table {
      font-size: 8pt;
    }

    .reports-wo-top-categories__list {
      display: flex;
      flex-direction: column;
      gap: 10pt;
    }

    .reports-wo-top-categories__group {
      border: 1px solid #d1d5db;
      border-radius: 4pt;
      background: #ffffff;
      margin-bottom: 10pt;
      overflow: hidden;
    }

    .reports-wo-top-categories__group--expanded {
      break-inside: auto;
      page-break-inside: auto;
    }

    .reports-wo-top-categories__group:not(.reports-wo-top-categories__group--expanded) {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .reports-wo-top-categories__row,
    .reports-wo-top-categories__row--print {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16pt;
      padding: 10pt 12pt;
      background: #f3f4f6;
      color: #1e1e1e;
    }

    .reports-wo-top-categories__group--expanded .reports-wo-top-categories__row--print,
    .reports-wo-top-categories__group--expanded .reports-wo-top-categories__row {
      border-bottom: 1px solid #d1d5db;
    }

    .reports-wo-top-categories__label {
      flex: 1;
      min-width: 0;
      font-size: 10pt;
      font-weight: 800;
      color: #1e1e1e;
    }

    .reports-wo-top-categories__count {
      flex-shrink: 0;
      font-size: 10pt;
      font-weight: 700;
      color: #1e1e1e;
    }

    .reports-wo-top-categories__details {
      padding: 10pt 12pt 12pt;
      background: #ffffff;
    }

    .reports-wo-top-categories__table {
      min-width: 0;
      width: 100%;
      font-size: 8.5pt;
    }

    .reports-wo-top-categories__empty {
      margin: 0;
      color: #4b5563;
      font-size: 9pt;
      font-style: italic;
    }

    .reports-wo-top-categories__title-text {
      color: #1e1e1e;
      font-weight: 600;
      text-decoration: none;
    }

    .reports-wo-top-areas__list {
      display: flex;
      flex-direction: column;
      gap: 10pt;
    }

    .reports-wo-top-areas__group {
      border: 1px solid #d1d5db;
      border-radius: 4pt;
      background: #ffffff;
      margin-bottom: 10pt;
      overflow: hidden;
    }

    .reports-wo-top-areas__group--expanded {
      break-inside: auto;
      page-break-inside: auto;
    }

    .reports-wo-top-areas__group:not(.reports-wo-top-areas__group--expanded) {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .reports-wo-top-areas__row,
    .reports-wo-top-areas__row--print {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16pt;
      padding: 10pt 12pt;
      background: #f3f4f6;
      color: #1e1e1e;
    }

    .reports-wo-top-areas__group--expanded .reports-wo-top-areas__row--print,
    .reports-wo-top-areas__group--expanded .reports-wo-top-areas__row {
      border-bottom: 1px solid #d1d5db;
    }

    .reports-wo-top-areas__label {
      flex: 1;
      min-width: 0;
      font-size: 10pt;
      font-weight: 800;
      color: #1e1e1e;
    }

    .reports-wo-top-areas__count {
      flex-shrink: 0;
      font-size: 10pt;
      font-weight: 700;
      color: #1e1e1e;
    }

    .reports-wo-top-areas__details {
      padding: 10pt 12pt 12pt;
      background: #ffffff;
    }

    .reports-wo-top-areas__table {
      min-width: 0;
      width: 100%;
      font-size: 8.5pt;
    }

    .reports-wo-top-areas__empty {
      margin: 0;
      color: #4b5563;
      font-size: 9pt;
      font-style: italic;
    }

    .reports-wo-top-areas__title-text {
      color: #1e1e1e;
      font-weight: 600;
      text-decoration: none;
    }
  `;
}

function buildReportPrintHtml(
  reportName: string,
  headerHtml: string,
  bodyHtml: string,
  orientation: "portrait" | "landscape"
): string {
  const title = reportName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>${buildReportPrintStyles(orientation)}</style>
  </head>
  <body>
    <div class="report-print">
      <header class="report-print__header">${headerHtml}</header>
      <main class="report-print__body">${bodyHtml}</main>
    </div>
  </body>
</html>`;
}

export type PrintReportDocumentOptions = {
  contentRoot: HTMLElement;
  reportName?: string;
};

export function printReportDocument(
  contentRootOrOptions: HTMLElement | PrintReportDocumentOptions
): void {
  const contentRoot =
    contentRootOrOptions instanceof HTMLElement
      ? contentRootOrOptions
      : contentRootOrOptions.contentRoot;
  const reportName =
    contentRootOrOptions instanceof HTMLElement
      ? contentRoot.querySelector(".reports-printable-output__title")?.textContent?.trim() ||
        "Report"
      : contentRootOrOptions.reportName ||
        contentRoot.querySelector(".reports-printable-output__title")?.textContent?.trim() ||
        "Report";

  const header = contentRoot.querySelector(".reports-printable-output__header");
  const body = contentRoot.querySelector(".reports-printable-output__body");

  if (!(header instanceof HTMLElement) || !(body instanceof HTMLElement)) return;

  const orientation = getPrintOrientation(body);
  const html = buildReportPrintHtml(
    reportName,
    header.innerHTML,
    normalizePrintBodyHtml(body),
    orientation
  );
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    return;
  }

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 250);
  };

  const runPrint = () => {
    frameWindow.focus();
    frameWindow.print();
    if ("onafterprint" in frameWindow) {
      frameWindow.addEventListener("afterprint", cleanup, { once: true });
    } else {
      cleanup();
    }
  };

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  if (frameDocument.readyState === "complete") {
    window.setTimeout(runPrint, 150);
  } else {
    iframe.onload = () => window.setTimeout(runPrint, 150);
  }
}

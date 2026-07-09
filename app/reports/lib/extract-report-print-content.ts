export type ReportPdfTable = {
  title?: string;
  headers: string[];
  rows: string[][];
};

function cleanCellText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function extractReportPdfTables(root: HTMLElement): ReportPdfTable[] {
  const tables: ReportPdfTable[] = [];

  root.querySelectorAll("table").forEach((table, index) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((cell) =>
      cleanCellText(cell.textContent)
    );

    const rows = Array.from(table.querySelectorAll("tbody tr"))
      .map((row) =>
        Array.from(row.querySelectorAll("td")).map((cell) => cleanCellText(cell.textContent))
      )
      .filter((row) => row.length > 0 && !row.every((cell) => !cell));

    if (headers.length > 0 && rows.length > 0) {
      tables.push({
        title: index > 0 ? `Table ${index + 1}` : undefined,
        headers,
        rows,
      });
    }
  });

  const groupRows = Array.from(root.querySelectorAll(".reports-wo-group-row"));
  if (groupRows.length > 0) {
    tables.push({
      title: tables.length > 0 ? "Summary" : undefined,
      headers: ["Label", "Count"],
      rows: groupRows.map((row) => [
        cleanCellText(row.querySelector(".reports-wo-group-row__label")?.textContent),
        cleanCellText(row.querySelector(".reports-wo-group-row__count")?.textContent),
      ]),
    });
  }

  const summaryCards = Array.from(root.querySelectorAll(".reports-wo-summary-card"));
  if (summaryCards.length > 0) {
    tables.push({
      title: "Summary",
      headers: ["Metric", "Value"],
      rows: summaryCards.map((card) => [
        cleanCellText(card.querySelector(".reports-wo-summary-card__label")?.textContent),
        cleanCellText(card.querySelector(".reports-wo-summary-card__value")?.textContent),
      ]),
    });
  }

  return tables;
}

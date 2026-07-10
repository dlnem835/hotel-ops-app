function cleanCellText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

type TopCategoriesPdfSection = {
  title?: string;
  headers: string[];
  rows: string[][];
};

function extractTableRows(table: HTMLTableElement): TopCategoriesPdfSection | null {
  const headers = Array.from(table.querySelectorAll("thead th")).map((cell) =>
    cleanCellText(cell.textContent)
  );

  const rows = Array.from(table.querySelectorAll("tbody tr"))
    .map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) => cleanCellText(cell.textContent))
    )
    .filter((row) => row.length > 0 && !row.every((cell) => !cell));

  if (headers.length === 0 || rows.length === 0) {
    return null;
  }

  return { headers, rows };
}

function formatTopCategorySectionTitle(label: string, count: string): string {
  return `${label}    Count: ${count}`;
}

/** Builds PDF tables from the currently rendered Top Categories report DOM. */
export function extractTopCategoriesReportPdfTables(
  root: HTMLElement
): TopCategoriesPdfSection[] {
  const tables: TopCategoriesPdfSection[] = [];

  root.querySelectorAll(".reports-wo-top-categories__group").forEach((group) => {
    const label = cleanCellText(
      group.querySelector(".reports-wo-top-categories__label")?.textContent
    );
    const count = cleanCellText(
      group.querySelector(".reports-wo-top-categories__count")?.textContent
    );
    const details = group.querySelector(".reports-wo-top-categories__details");

    if (!details) {
      tables.push({
        title: formatTopCategorySectionTitle(label, count),
        headers: [],
        rows: [],
      });
      return;
    }

    const emptyMessage = cleanCellText(
      group.querySelector(".reports-wo-top-categories__empty")?.textContent
    );
    if (emptyMessage) {
      tables.push({
        title: formatTopCategorySectionTitle(label, count),
        headers: ["Details"],
        rows: [[emptyMessage]],
      });
      return;
    }

    const workOrderTable = group.querySelector("table");
    if (!(workOrderTable instanceof HTMLTableElement)) {
      tables.push({
        title: formatTopCategorySectionTitle(label, count),
        headers: [],
        rows: [],
      });
      return;
    }

    const extracted = extractTableRows(workOrderTable);
    if (!extracted) {
      tables.push({
        title: formatTopCategorySectionTitle(label, count),
        headers: [],
        rows: [],
      });
      return;
    }

    tables.push({
      title: formatTopCategorySectionTitle(label, count),
      headers: extracted.headers,
      rows: extracted.rows,
    });
  });

  return tables;
}

/** Normalizes Top Categories DOM for print while preserving visible expand/collapse state. */
export function normalizeTopCategoriesPrintBodyHtml(bodyRoot: HTMLElement): string {
  const clone = bodyRoot.cloneNode(true) as HTMLElement;

  clone.querySelectorAll(".reports-wo-top-categories__error").forEach((node) => {
    node.remove();
  });

  clone.querySelectorAll(".reports-wo-top-categories__chevron").forEach((node) => {
    node.remove();
  });

  clone.querySelectorAll(".reports-wo-top-categories__row").forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;

    const label = cleanCellText(
      button.querySelector(".reports-wo-top-categories__label")?.textContent
    );
    const count = cleanCellText(
      button.querySelector(".reports-wo-top-categories__count")?.textContent
    );

    const row = document.createElement("div");
    row.className =
      "reports-wo-top-categories__row reports-wo-top-categories__row--print";

    const labelSpan = document.createElement("span");
    labelSpan.className = "reports-wo-top-categories__label";
    labelSpan.textContent = label;

    const countSpan = document.createElement("span");
    countSpan.className = "reports-wo-top-categories__count";
    countSpan.textContent = count;

    row.append(labelSpan, countSpan);
    button.replaceWith(row);
  });

  clone.querySelectorAll("button").forEach((button) => {
    const text = cleanCellText(button.textContent);
    const span = document.createElement("span");
    span.textContent = text;

    if (button.classList.contains("reports-wo-top-categories__title-link")) {
      span.className = "reports-wo-top-categories__title-text";
    } else if (button.classList.contains("reports-pm-results__source-link")) {
      span.className = "reports-pm-results__source-link";
    }

    button.replaceWith(span);
  });

  clone.querySelectorAll("a").forEach((anchor) => {
    const span = document.createElement("span");
    span.textContent = cleanCellText(anchor.textContent);
    anchor.replaceWith(span);
  });

  return clone.innerHTML;
}

export function isTopCategoriesReportBody(bodyRoot: HTMLElement): boolean {
  return Boolean(bodyRoot.querySelector(".reports-wo-top-categories"));
}

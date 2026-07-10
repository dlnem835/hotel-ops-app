export function buildScheduledReportEmailHtml(input: {
  reportName: string;
  propertyName: string;
  dateRangeLabel: string;
  generatedAtLabel: string;
  filterLines: string[];
}): string {
  const filterHtml = input.filterLines
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #1a1815; line-height: 1.5;">
      <p style="margin: 0 0 8px; font-size: 12px; letter-spacing: 0.08em; color: #c8a96a; font-weight: 700;">
        ONE EYRIE
      </p>
      <h1 style="margin: 0 0 16px; font-size: 22px;">${escapeHtml(input.reportName)}</h1>
      <p style="margin: 0 0 12px;">
        This is a scheduled report from One Eyrie. The current filtered results are attached as a PDF.
      </p>
      <table style="border-collapse: collapse; margin: 0 0 16px;">
        <tr><td style="padding: 4px 12px 4px 0; font-weight: 700;">Property</td><td>${escapeHtml(input.propertyName)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; font-weight: 700;">Date range</td><td>${escapeHtml(input.dateRangeLabel)}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; font-weight: 700;">Generated</td><td>${escapeHtml(input.generatedAtLabel)}</td></tr>
      </table>
      ${
        filterHtml
          ? `<p style="margin: 0 0 8px; font-weight: 700;">Filters</p><ul style="margin: 0 0 16px; padding-left: 20px;">${filterHtml}</ul>`
          : ""
      }
      <p style="margin: 0; color: #4b5563; font-size: 13px;">
        Please open the attached PDF for the full report output.
      </p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseScheduleRecipients(recipients: string): string[] {
  return recipients
    .split(/[,;\n]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value.includes("@"));
}

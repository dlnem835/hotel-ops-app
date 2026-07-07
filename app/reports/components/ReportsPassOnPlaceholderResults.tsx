import type { PassOnReportId } from "@/app/reports/lib/report-definitions";

const SAMPLE_PASS_ON_ROWS = [
  {
    associate: "J. Martinez",
    shift: "AM",
    excerpt: "Pool pump noise reported in Room 312 wing.",
    edited: false,
    date: "Jun 18, 2026 · 7:45 AM",
  },
  {
    associate: "Front Desk",
    shift: "PM",
    excerpt: "VIP arrival — upgrade confirmed for Room 204.",
    edited: true,
    date: "Jun 17, 2026 · 3:10 PM",
  },
  {
    associate: "D. Chen",
    shift: "Overnight",
    excerpt: "Fire panel test completed without issues.",
    edited: false,
    date: "Jun 17, 2026 · 11:20 PM",
  },
];

export default function ReportsPassOnPlaceholderResults({
  reportId,
}: {
  reportId: PassOnReportId;
}) {
  if (reportId === "entries-by-associate") {
    return (
      <GroupedResults
        lead="Sample preview — pass-on entries grouped by associate."
        groups={[
          { label: "J. Martinez", count: 12 },
          { label: "Front Desk", count: 18 },
          { label: "D. Chen", count: 9 },
        ]}
      />
    );
  }

  if (reportId === "entries-by-shift") {
    return (
      <GroupedResults
        lead="Sample preview — pass-on entries grouped by shift."
        groups={[
          { label: "AM", count: 14 },
          { label: "PM", count: 16 },
          { label: "Overnight", count: 9 },
        ]}
      />
    );
  }

  if (reportId === "edited-entries") {
    const edited = SAMPLE_PASS_ON_ROWS.filter((row) => row.edited);
    return (
      <TableResults
        lead="Sample preview — edited pass-on entries."
        headers={["Associate", "Shift", "Excerpt", "Updated"]}
        rows={edited.map((row) => [row.associate, row.shift, row.excerpt, row.date])}
      />
    );
  }

  return (
    <TableResults
      lead="Sample preview — keyword search matches across pass-on entries."
      headers={["Associate", "Shift", "Excerpt", "Date"]}
      rows={SAMPLE_PASS_ON_ROWS.map((row) => [
        row.associate,
        row.shift,
        row.excerpt,
        row.date,
      ])}
    />
  );
}

function GroupedResults({
  lead,
  groups,
}: {
  lead: string;
  groups: Array<{ label: string; count: number }>;
}) {
  return (
    <div className="reports-wo-results">
      <p className="reports-pm-results__lead">{lead}</p>
      <div className="reports-wo-group-list">
        {groups.map((group) => (
          <div key={group.label} className="reports-wo-group-row">
            <span className="reports-wo-group-row__label">{group.label}</span>
            <span className="reports-wo-group-row__count">{group.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableResults({
  lead,
  headers,
  rows,
}: {
  lead: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="reports-wo-results">
      <p className="reports-pm-results__lead">{lead}</p>
      <div className="reports-pm-results__table-wrap">
        <table className="reports-pm-results__table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

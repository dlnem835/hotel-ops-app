import Link from "next/link";
import { loadPassOnListForMobile, groupEntriesByDate } from "./lib/pass-on-server";
import { dateHeader } from "./lib/pass-on-shared";
import { priorityClassName } from "./lib/pass-on-priority";
import MobilePassOnLogListActions from "./MobilePassOnLogListActions";

export const dynamic = "force-dynamic";

export default async function MobilePassOnLogPage() {
  let error: string | null = null;
  let groupedEntries: ReturnType<typeof groupEntriesByDate> = [];

  try {
    const entries = await loadPassOnListForMobile();
    groupedEntries = groupEntriesByDate(entries);
  } catch (loadError) {
    error = loadError instanceof Error ? loadError.message : "Unable to load pass-on log";
  }

  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-pass-on">
      <Link href="/mobile" className="one-eyrie-mobile-back">
        ← Home
      </Link>
      <h1 className="one-eyrie-mobile-page-title">Pass-On Log</h1>
      <p className="one-eyrie-mobile-subheading" style={{ marginTop: 8 }}>
        Today and recent shift notes
      </p>

      {error ? <div className="one-eyrie-mobile-error">{error}</div> : null}

      {!error && groupedEntries.length === 0 ? (
        <div className="one-eyrie-mobile-status">No pass-on entries for today or recent dates.</div>
      ) : null}

      {!error && groupedEntries.length > 0 ? (
        <div className="one-eyrie-mobile-pass-on-groups">
          {groupedEntries.map(([date, dateEntries]) => (
            <section key={date} className="one-eyrie-mobile-pass-on-group">
              <h2 className="one-eyrie-mobile-pass-on-group__title">{dateHeader(date)}</h2>
              <div className="one-eyrie-mobile-list">
                {dateEntries.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/mobile/pass-on-log/${entry.id}`}
                    className="one-eyrie-mobile-row one-eyrie-mobile-row--list"
                  >
                    <div className="one-eyrie-mobile-row__top">
                      <p className="one-eyrie-mobile-row__title">{entry.subject}</p>
                      <span className={priorityClassName(entry.priority || "Normal")}>
                        {entry.priority || "Normal"}
                      </span>
                    </div>
                    <div className="one-eyrie-mobile-row__meta">
                      <span>{entry.author || "Unknown"}</span>
                      <span>
                        {new Date(entry.created_at).toLocaleString([], {
                          month: "numeric",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {(entry.pass_on_log_replies?.length || 0) > 0 ? (
                        <span>
                          {entry.pass_on_log_replies.length} repl
                          {entry.pass_on_log_replies.length === 1 ? "y" : "ies"}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      <MobilePassOnLogListActions />
    </div>
  );
}

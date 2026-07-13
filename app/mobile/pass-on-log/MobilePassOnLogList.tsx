"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getClientSession } from "@/app/lib/auth";
import { priorityClassName } from "./lib/pass-on-priority";
import {
  dateHeader,
  fetchPassOnEntries,
  fetchTeamMembers,
  filterPassOnEntriesBySearch,
  filterRecentPassOnEntries,
  groupEntriesByDate,
  isPassOnReadByUser,
  PassOnEntry,
  resolvePassOnAuthorDisplay,
} from "./lib/pass-on-shared";

export default function MobilePassOnLogList() {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState<PassOnEntry[]>([]);
  const [readBaseline, setReadBaseline] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [teamMembers, setTeamMembers] = useState<Awaited<ReturnType<typeof fetchTeamMembers>>>([]);

  const filteredEntries = useMemo(
    () => filterPassOnEntriesBySearch(entries, search),
    [entries, search]
  );
  const groupedEntries = groupEntriesByDate(filteredEntries);

  useEffect(() => {
    void fetchTeamMembers()
      .then(setTeamMembers)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void getClientSession().then((session) => {
      setAuthUserId(session?.user.id ?? null);
    });
  }, []);

  useEffect(() => {
    void fetchPassOnEntries()
      .then((result) => {
        setEntries(filterRecentPassOnEntries(result.entries));
        setReadBaseline(result.readBaseline);
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return <div className="one-eyrie-mobile-status">Loading pass-on log…</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="one-eyrie-mobile-status">No pass-on entries for today or recent dates.</div>
    );
  }

  return (
    <>
      <div className="one-eyrie-mobile-search-wrap one-eyrie-mobile-pass-on-search-wrap pass-on-search-wrap">
        <Search size={18} className="pass-on-search-wrap__icon" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pass-on entries..."
          className="one-eyrie-mobile-search"
          aria-label="Search pass-on entries"
        />
      </div>

      {groupedEntries.length === 0 ? (
        <div className="one-eyrie-mobile-status">No pass-on entries match your search.</div>
      ) : (
        <div className="one-eyrie-mobile-pass-on-groups">
          {groupedEntries.map(([date, dateEntries]) => (
            <section key={date} className="one-eyrie-mobile-pass-on-group">
              <h2 className="one-eyrie-mobile-pass-on-group__title">{dateHeader(date)}</h2>
              <div className="one-eyrie-mobile-list">
                {dateEntries.map((entry) => {
                  const isRead = isPassOnReadByUser(entry, authUserId, readBaseline);

                  return (
                    <Link
                      key={entry.id}
                      href={`/mobile/pass-on-log/${entry.id}`}
                      className={`one-eyrie-mobile-row one-eyrie-mobile-row--list${
                        isRead
                          ? " one-eyrie-mobile-row--read"
                          : " one-eyrie-mobile-row--unread"
                      }`}
                    >
                      <div className="one-eyrie-mobile-pass-on-row__main">
                        <div className="one-eyrie-mobile-row__top">
                          <div className="one-eyrie-mobile-row__title-wrap">
                            <span
                              className={`one-eyrie-mobile-pass-on-read-dot${
                                isRead ? " one-eyrie-mobile-pass-on-read-dot--read" : ""
                              }`}
                              aria-label={isRead ? "Read" : "Unread"}
                            />
                            <p className="one-eyrie-mobile-row__title">{entry.subject}</p>
                          </div>
                          <span className={priorityClassName(entry.priority || "Normal")}>
                            {entry.priority || "Normal"}
                          </span>
                        </div>
                        <div className="one-eyrie-mobile-row__meta">
                          <span>{resolvePassOnAuthorDisplay(teamMembers, entry.author)}</span>
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
                      </div>
                      <ChevronRight
                        size={18}
                        className="one-eyrie-mobile-pass-on-row__chevron"
                        aria-hidden
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

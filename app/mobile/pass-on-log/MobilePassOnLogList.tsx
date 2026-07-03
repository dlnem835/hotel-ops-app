"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getClientSession } from "@/app/lib/auth";
import { priorityClassName } from "./lib/pass-on-priority";
import {
  dateHeader,
  fetchPassOnEntries,
  fetchTeamMembers,
  filterRecentPassOnEntries,
  groupEntriesByDate,
  isPassOnReadByUser,
  PassOnEntry,
  resolvePassOnAuthorDisplay,
} from "./lib/pass-on-shared";

type MobilePassOnLogListProps = {
  entries: PassOnEntry[];
};

export default function MobilePassOnLogList({ entries: initialEntries }: MobilePassOnLogListProps) {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [entries, setEntries] = useState(initialEntries);
  const [teamMembers, setTeamMembers] = useState<Awaited<ReturnType<typeof fetchTeamMembers>>>([]);
  const groupedEntries = groupEntriesByDate(entries);

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
      .then((data) => setEntries(filterRecentPassOnEntries(data)))
      .catch(() => undefined);
  }, []);

  if (groupedEntries.length === 0) {
    return (
      <div className="one-eyrie-mobile-status">No pass-on entries for today or recent dates.</div>
    );
  }

  return (
    <div className="one-eyrie-mobile-pass-on-groups">
      {groupedEntries.map(([date, dateEntries]) => (
        <section key={date} className="one-eyrie-mobile-pass-on-group">
          <h2 className="one-eyrie-mobile-pass-on-group__title">{dateHeader(date)}</h2>
          <div className="one-eyrie-mobile-list">
            {dateEntries.map((entry) => {
              const isRead = isPassOnReadByUser(entry, authUserId);

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
  );
}

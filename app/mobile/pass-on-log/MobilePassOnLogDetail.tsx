"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addPassOnReply,
  formatDateTime,
  markPassOnAsViewed,
  PassOnEntry,
  resolveCurrentUserName,
} from "./lib/pass-on-shared";
import { priorityClassName } from "./lib/pass-on-priority";

type MobilePassOnLogDetailProps = {
  entry: PassOnEntry;
};

export default function MobilePassOnLogDetail({ entry }: MobilePassOnLogDetailProps) {
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    void resolveCurrentUserName().then(setCurrentUserName);
    void markPassOnAsViewed(entry.id);
  }, [entry.id]);

  const replies = useMemo(() => {
    return [...(entry.pass_on_log_replies || [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [entry.pass_on_log_replies]);

  async function handleReply(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const text = replyText.trim();
    if (!text) {
      setError("Reply cannot be empty.");
      return;
    }

    let author = currentUserName;
    if (!author) {
      author = await resolveCurrentUserName();
      if (!author) {
        window.location.href = "/login";
        return;
      }
      setCurrentUserName(author);
    }

    setSaving(true);
    try {
      await addPassOnReply(entry.id, author, text);
      window.location.assign(`/mobile/pass-on-log/${entry.id}`);
    } catch (replyError) {
      setSaving(false);
      setError(replyError instanceof Error ? replyError.message : "Unable to send reply");
    }
  }

  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-pass-on">
      <Link href="/mobile/pass-on-log" className="one-eyrie-mobile-back">
        ← Pass-On Log
      </Link>

      <h1 className="one-eyrie-mobile-page-title">{entry.subject}</h1>
      <div className="one-eyrie-mobile-row__meta" style={{ marginTop: 10 }}>
        <span className={priorityClassName(entry.priority || "Normal")}>
          {entry.priority || "Normal"}
        </span>
        <span>{entry.author || "Unknown"}</span>
        <span>{formatDateTime(entry.created_at)}</span>
      </div>

      {entry.edited_at ? (
        <p className="one-eyrie-mobile-pass-on-edited">
          Edited {formatDateTime(entry.edited_at)}
        </p>
      ) : null}

      <div className="one-eyrie-mobile-panel one-eyrie-mobile-pass-on-message">
        <p>{entry.message}</p>
      </div>

      <section className="one-eyrie-mobile-pass-on-replies">
        <h2 className="one-eyrie-mobile-pass-on-replies__title">
          Replies ({replies.length})
        </h2>
        {replies.length === 0 ? (
          <div className="one-eyrie-mobile-status">No replies yet.</div>
        ) : (
          replies.map((reply) => (
            <div key={reply.id} className="one-eyrie-mobile-panel one-eyrie-mobile-reply">
              <div className="one-eyrie-mobile-reply__author">{reply.reply_author}</div>
              <div className="one-eyrie-mobile-reply__body">{reply.reply_message}</div>
              <div className="one-eyrie-mobile-pass-on-meta-line">
                {formatDateTime(reply.created_at)}
              </div>
            </div>
          ))
        )}
      </section>

      {error ? <div className="one-eyrie-mobile-error">{error}</div> : null}

      <form onSubmit={(event) => void handleReply(event)} className="one-eyrie-mobile-pass-on-reply-form">
        <div className="one-eyrie-mobile-field">
          <label htmlFor="pass-on-reply">Add reply</label>
          <textarea
            id="pass-on-reply"
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Write a reply..."
          />
        </div>
        <button
          type="submit"
          className="one-eyrie-mobile-btn one-eyrie-mobile-btn--gold"
          disabled={saving}
        >
          {saving ? "Sending…" : "Send Reply"}
        </button>
      </form>
    </div>
  );
}

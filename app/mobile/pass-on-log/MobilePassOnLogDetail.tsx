"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { redirectToLogin } from "@/app/lib/auth";
import {
  addPassOnReply,
  fetchPassOnEntries,
  fetchTeamMembers,
  filterRecentPassOnEntries,
  findAdjacentPassOnEntryIds,
  formatDateTime,
  markPassOnAsViewed,
  PassOnEntry,
  resolveCurrentUserName,
  resolvePassOnAuthorDisplay,
  uploadPassOnAttachment,
} from "./lib/pass-on-shared";
import { priorityClassName } from "./lib/pass-on-priority";
import PassOnAttachments from "@/app/pass-on-log/components/PassOnAttachments";

type MobilePassOnLogDetailProps = {
  entry: PassOnEntry;
};

export default function MobilePassOnLogDetail({ entry }: MobilePassOnLogDetailProps) {
  const router = useRouter();
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Awaited<ReturnType<typeof fetchTeamMembers>>>([]);
  const [navEntries, setNavEntries] = useState<PassOnEntry[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);

  useEffect(() => {
    setReplyText("");
    setError(null);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    void resolveCurrentUserName().then(setCurrentUserName);
    void fetchTeamMembers().then(setTeamMembers).catch(() => undefined);
    void markPassOnAsViewed(entry.id);
  }, [entry.id]);

  useEffect(() => {
    let cancelled = false;
    void fetchPassOnEntries()
      .then((result) => {
        if (cancelled) return;
        setNavEntries(filterRecentPassOnEntries(result.entries));
      })
      .catch(() => {
        if (!cancelled) setNavEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const replies = useMemo(() => {
    return [...(entry.pass_on_log_replies || [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [entry.pass_on_log_replies]);

  const { previousId, nextId } = useMemo(
    () => findAdjacentPassOnEntryIds(navEntries, entry.id),
    [navEntries, entry.id]
  );

  function confirmLeaveIfNeeded(): boolean {
    if (!replyText.trim() && replyAttachments.length === 0) return true;
    return window.confirm(
      "You have an unsaved reply. Leave this entry without sending it?"
    );
  }

  function navigateToEntry(targetId: number | null) {
    if (targetId == null) return;
    if (!confirmLeaveIfNeeded()) return;
    router.push(`/mobile/pass-on-log/${targetId}`);
  }

  function handleBackClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!confirmLeaveIfNeeded()) {
      event.preventDefault();
    }
  }

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
        redirectToLogin();
        return;
      }
      setCurrentUserName(author);
    }

    setSaving(true);
    try {
      const reply = await addPassOnReply(entry.id, author, text);
      try {
        for (const file of replyAttachments) {
          await uploadPassOnAttachment(entry.id, file, reply.id);
        }
      } catch (uploadError) {
        window.alert(
          uploadError instanceof Error
            ? `Reply sent, but an attachment failed: ${uploadError.message}`
            : "Reply sent, but an attachment failed to upload."
        );
      }
      window.location.assign(`/mobile/pass-on-log/${entry.id}`);
    } catch (replyError) {
      setSaving(false);
      setError(replyError instanceof Error ? replyError.message : "Unable to send reply");
    }
  }

  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-pass-on">
      <Link
        href="/mobile/pass-on-log"
        className="one-eyrie-mobile-back"
        onClick={handleBackClick}
      >
        ← Pass-On Log
      </Link>

      <h1 className="one-eyrie-mobile-page-title">{entry.subject}</h1>
      <div className="one-eyrie-mobile-row__meta" style={{ marginTop: 10 }}>
        <span className={priorityClassName(entry.priority || "Normal")}>
          {entry.priority || "Normal"}
        </span>
        <span>{resolvePassOnAuthorDisplay(teamMembers, entry.author)}</span>
        <span>{formatDateTime(entry.created_at)}</span>
      </div>

      {entry.edited_at ? (
        <p className="one-eyrie-mobile-pass-on-edited">
          Edited {formatDateTime(entry.edited_at)}
        </p>
      ) : null}

      <div className="one-eyrie-mobile-pass-on-message">
        <p>{entry.message}</p>
      </div>

      <PassOnAttachments
        entryId={entry.id}
        attachments={(entry.pass_on_log_attachments || []).filter(
          (attachment) => !attachment.reply_id
        )}
        allowUpload={false}
      />

      {replies.length > 0 ? (
        <section className="one-eyrie-mobile-pass-on-replies">
          <h2 className="one-eyrie-mobile-pass-on-replies__title">
            {replies.length === 1 ? "1 Reply" : `${replies.length} Replies`}
          </h2>
          {replies.map((reply) => (
            <div key={reply.id} className="one-eyrie-mobile-reply">
              <p className="one-eyrie-mobile-reply__text">
                <strong>{resolvePassOnAuthorDisplay(teamMembers, reply.reply_author)}:</strong>{" "}
                {reply.reply_message}
              </p>
              <PassOnAttachments
                entryId={entry.id}
                attachments={(entry.pass_on_log_attachments || []).filter(
                  (attachment) =>
                    Number(attachment.reply_id) === Number(reply.id)
                )}
                allowUpload={false}
              />
            </div>
          ))}
        </section>
      ) : null}

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
        <PassOnAttachments
          pendingFiles={replyAttachments}
          onPendingFilesChange={setReplyAttachments}
          disabled={saving}
        />
      </form>

      <div className="one-eyrie-mobile-pass-on-nav" role="navigation" aria-label="Pass-on entry">
        <button
          type="button"
          className="one-eyrie-mobile-pass-on-nav__btn"
          disabled={previousId == null}
          onClick={() => navigateToEntry(previousId)}
        >
          ← Previous
        </button>
        <button
          type="button"
          className="one-eyrie-mobile-pass-on-nav__btn"
          disabled={nextId == null}
          onClick={() => navigateToEntry(nextId)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

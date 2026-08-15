"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { redirectToLogin } from "@/app/lib/auth";
import {
  createPassOnEntry,
  getLocalDateString,
  resolveCurrentUserName,
  uploadPassOnAttachment,
} from "./lib/pass-on-shared";
import PassOnAttachments from "@/app/pass-on-log/components/PassOnAttachments";

export default function MobilePassOnLogNew() {
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [message, setMessage] = useState("");
  const [entryDate, setEntryDate] = useState(getLocalDateString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    void resolveCurrentUserName().then(setAuthor);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!subject.trim() || !message.trim()) {
      setError("Subject and message are required.");
      return;
    }

    let currentAuthor = author;
    if (!currentAuthor) {
      currentAuthor = await resolveCurrentUserName();
      if (!currentAuthor) {
        redirectToLogin();
        return;
      }
    }

    setSaving(true);
    try {
      const entry = await createPassOnEntry({
        subject: subject.trim(),
        message: message.trim(),
        priority,
        entryDate,
        author: currentAuthor,
      });
      try {
        for (const file of attachments) {
          await uploadPassOnAttachment(entry.id, file);
        }
      } catch (uploadError) {
        window.alert(
          uploadError instanceof Error
            ? `Pass-on posted, but an attachment failed: ${uploadError.message}`
            : "Pass-on posted, but an attachment failed to upload."
        );
      }
      window.location.assign("/mobile/pass-on-log");
    } catch (saveError) {
      setSaving(false);
      setError(saveError instanceof Error ? saveError.message : "Unable to save entry");
    }
  }

  return (
    <div className="one-eyrie-mobile__inner one-eyrie-mobile-pass-on">
      <Link href="/mobile/pass-on-log" className="one-eyrie-mobile-back">
        ← Pass-On Log
      </Link>
      <h1 className="one-eyrie-mobile-page-title">New Pass-On</h1>
      <p className="one-eyrie-mobile-subheading" style={{ marginTop: 8 }}>
        Add a shift note for the team
      </p>

      {error ? <div className="one-eyrie-mobile-error">{error}</div> : null}

      <form onSubmit={(event) => void handleSubmit(event)} className="one-eyrie-mobile-pass-on-form">
        <div className="one-eyrie-mobile-field">
          <label htmlFor="pass-on-subject">Subject</label>
          <input
            id="pass-on-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject"
            required
          />
        </div>

        <div className="one-eyrie-mobile-field">
          <label htmlFor="pass-on-priority">Priority</label>
          <select
            id="pass-on-priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="Normal">Normal</option>
            <option value="Important">Important</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>

        <div className="one-eyrie-mobile-field">
          <label htmlFor="pass-on-date">Date</label>
          <input
            id="pass-on-date"
            type="date"
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
            required
          />
        </div>

        <div className="one-eyrie-mobile-field">
          <label htmlFor="pass-on-message">Message</label>
          <textarea
            id="pass-on-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write pass-on note..."
            required
          />
        </div>

        <PassOnAttachments
          pendingFiles={attachments}
          onPendingFilesChange={setAttachments}
          disabled={saving}
        />

        <div className="one-eyrie-mobile-actions">
          <button
            type="submit"
            className="one-eyrie-mobile-btn one-eyrie-mobile-btn--gold"
            disabled={saving}
          >
            {saving ? "Saving…" : "Add Entry"}
          </button>
          <Link href="/mobile/pass-on-log" className="one-eyrie-mobile-btn one-eyrie-mobile-btn--link">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

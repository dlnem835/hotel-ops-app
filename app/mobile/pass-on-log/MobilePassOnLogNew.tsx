"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createPassOnEntry,
  getLocalDateString,
  getPassOnSession,
  resolveCurrentUserName,
} from "./lib/pass-on-shared";

export default function MobilePassOnLogNew() {
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [message, setMessage] = useState("");
  const [entryDate, setEntryDate] = useState(getLocalDateString());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);

  useEffect(() => {
    void resolveCurrentUserName().then(setAuthor);
    void getPassOnSession().then((session) => {
      if (!session) {
        window.location.href = "/login";
      }
    });
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
        window.location.href = "/login";
        return;
      }
    }

    setSaving(true);
    try {
      await createPassOnEntry({
        subject: subject.trim(),
        message: message.trim(),
        priority,
        entryDate,
        author: currentAuthor,
      });
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

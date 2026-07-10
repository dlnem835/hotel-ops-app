"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { isPassOnReadByUser } from "@/app/pass-on-log/lib/pass-on-views";
import { buildMemberDisplayNameResolver } from "@/app/lib/member-display-name";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import {
  derivePassOnShift,
  formatPassOnReportDateTime,
  resolveAuthorDisplay,
} from "@/app/reports/lib/pass-on-report-filter-utils";
import type { PassOnReportTeamMember } from "@/app/reports/lib/pass-on-report-types";

type ReportsPassOnEntryDetailModalProps = {
  entryId: number;
  onClose: () => void;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ReportsPassOnEntryDetailModal({
  entryId,
  onClose,
}: ReportsPassOnEntryDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [shift, setShift] = useState("—");
  const [createdBy, setCreatedBy] = useState("—");
  const [createdAt, setCreatedAt] = useState("—");
  const [editedAt, setEditedAt] = useState<string | null>(null);
  const [readSummary, setReadSummary] = useState<{
    readCount: number;
    unreadCount: number;
    readNames: string[];
    unreadNames: string[];
  } | null>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [handleClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      setError(null);

      try {
        const [entryResult, membersResult] = await Promise.all([
          supabase
            .from("pass_on_log")
            .select("*, pass_on_log_replies(created_at), pass_on_log_views(auth_user_id, viewed_at)")
            .eq("id", entryId)
            .maybeSingle(),
          supabase
            .from("team_members")
            .select("auth_user_id, username, first_name, last_name, department"),
        ]);

        if (entryResult.error) throw new Error(entryResult.error.message);
        if (membersResult.error) throw new Error(membersResult.error.message);
        if (!entryResult.data) throw new Error("Pass-On entry not found.");

        if (cancelled) return;

        const members = ((membersResult.data || []) as Array<{
          auth_user_id: string;
          username: string | null;
          first_name: string | null;
          last_name: string | null;
          department: string | null;
        }>).map((row) => ({
          authUserId: row.auth_user_id,
          username: row.username,
          firstName: row.first_name,
          lastName: row.last_name,
          department: row.department,
          displayName:
            buildMemberDisplayNameResolver([row]).displayForAuthUserId(row.auth_user_id) ||
            row.username ||
            "Team member",
        })) as PassOnReportTeamMember[];

        const entry = entryResult.data;
        const views = entry.pass_on_log_views || [];
        const replies = entry.pass_on_log_replies || [];
        const readNames: string[] = [];
        const unreadNames: string[] = [];

        for (const member of members) {
          const isRead = isPassOnReadByUser(
            { pass_on_log_views: views, pass_on_log_replies: replies },
            member.authUserId
          );
          if (isRead) readNames.push(member.displayName);
          else unreadNames.push(member.displayName);
        }

        setSubject(entry.subject?.trim() || "(No subject)");
        setMessage(entry.message?.trim() || "");
        setPriority(entry.priority?.trim() || "Normal");
        setShift(derivePassOnShift(entry.created_at));
        setCreatedBy(resolveAuthorDisplay(members, entry.author));
        setCreatedAt(formatPassOnReportDateTime(entry.created_at));
        setEditedAt(entry.edited_at ?? null);
        setReadSummary({
          readCount: readNames.length,
          unreadCount: unreadNames.length,
          readNames,
          unreadNames,
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Unable to load Pass-On entry."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [entryId]);

  const editedLabel = useMemo(
    () => (editedAt ? formatPassOnReportDateTime(editedAt) : null),
    [editedAt]
  );

  return (
    <div
      role="presentation"
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(0, 0, 0, 0.72)",
        display: "flex",
        justifyContent: "center",
        alignItems: "stretch",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reports-pass-on-entry-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(860px, 100%)",
          height: "100%",
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: "14px",
          overflow: "hidden",
          border: `1px solid ${ONE_EYRIE.border}`,
          background: ONE_EYRIE.black,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${ONE_EYRIE.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="reports-pm-results__source-link"
            onClick={handleClose}
          >
            ← Back to Report
          </button>
          <span
            style={{
              color: ONE_EYRIE.textSubtle,
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Read Only
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px" }}>
          {loading ? (
            <p style={{ color: ONE_EYRIE.textMuted, margin: 0 }}>Loading Pass-On entry…</p>
          ) : error ? (
            <>
              <p className="reports-all-work-orders__error" role="alert">
                {error}
              </p>
              <button
                type="button"
                className="reports-pm-results__source-link"
                onClick={handleClose}
                style={{ marginTop: "12px" }}
              >
                Back to Report
              </button>
            </>
          ) : (
            <>
              <h2
                id="reports-pass-on-entry-title"
                style={{ margin: "0 0 12px", color: ONE_EYRIE.gold, fontSize: "24px" }}
              >
                {subject}
              </h2>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px 16px",
                  marginBottom: "16px",
                  color: ONE_EYRIE.textSubtle,
                  fontSize: "14px",
                }}
              >
                <span>
                  <strong style={{ color: ONE_EYRIE.textMuted }}>Shift:</strong> {shift}
                </span>
                <span>
                  <strong style={{ color: ONE_EYRIE.textMuted }}>Priority:</strong> {priority}
                </span>
                <span>
                  <strong style={{ color: ONE_EYRIE.textMuted }}>Created By:</strong> {createdBy}
                </span>
                <span>
                  <strong style={{ color: ONE_EYRIE.textMuted }}>Created:</strong> {createdAt}
                </span>
                {editedLabel ? (
                  <span>
                    <strong style={{ color: ONE_EYRIE.textMuted }}>Edited:</strong> {editedLabel}
                  </span>
                ) : null}
              </div>

              <div
                style={{
                  whiteSpace: "pre-wrap",
                  color: ONE_EYRIE.text,
                  lineHeight: 1.6,
                  fontSize: "15px",
                  marginBottom: "20px",
                }}
              >
                {message || "—"}
              </div>

              {readSummary ? (
                <div
                  style={{
                    borderTop: `1px solid ${ONE_EYRIE.border}`,
                    paddingTop: "16px",
                    color: ONE_EYRIE.textSubtle,
                    fontSize: "14px",
                  }}
                >
                  <p style={{ margin: "0 0 8px" }}>
                    <strong style={{ color: ONE_EYRIE.textMuted }}>Read summary:</strong>{" "}
                    {readSummary.readCount} read · {readSummary.unreadCount} unread
                  </p>
                  {readSummary.readNames.length > 0 ? (
                    <p style={{ margin: "0 0 8px" }}>
                      <strong style={{ color: ONE_EYRIE.textMuted }}>Read by:</strong>{" "}
                      {readSummary.readNames.join(", ")}
                    </p>
                  ) : null}
                  {readSummary.unreadNames.length > 0 ? (
                    <p style={{ margin: 0 }}>
                      <strong style={{ color: ONE_EYRIE.textMuted }}>Unread by:</strong>{" "}
                      {readSummary.unreadNames.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { supabase } from "@/app/supabaseClient";

type PageState = "loading" | "ready" | "invalid" | "success";

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    let recoveryDetected = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY") {
        recoveryDetected = true;
        setPageState("ready");
        return;
      }

      if (event === "INITIAL_SESSION") {
        if (session) {
          // Hash/code exchange may establish a session before PASSWORD_RECOVERY fires.
          recoveryDetected = true;
          setPageState("ready");
        } else {
          window.setTimeout(() => {
            if (!mounted || recoveryDetected) return;
            setPageState("invalid");
          }, 2500);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message || "Unable to update password. The link may have expired.");
      return;
    }

    setPageState("success");
    await supabase.auth.signOut();
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <OneEyrieWordmark className="one-eyrie-wordmark--sidebar one-eyrie-wordmark--login" />
        <p style={{ color: ONE_EYRIE.gold, marginTop: 0 }}>Reset password</p>

        {pageState === "loading" ? (
          <p style={{ color: ONE_EYRIE.textMuted }}>Verifying reset link…</p>
        ) : null}

        {pageState === "invalid" ? (
          <div style={noticeStyle}>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              This password reset link is invalid or has expired.
            </p>
            <p style={{ margin: "14px 0 0" }}>
              <Link href="/forgot-password" style={linkStyle}>
                Request a new reset link
              </Link>
            </p>
          </div>
        ) : null}

        {pageState === "success" ? (
          <div style={noticeStyle}>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              Your password has been updated. You can now sign in.
            </p>
            <p style={{ margin: "14px 0 0" }}>
              <Link href="/login" style={linkStyle}>
                Go to sign in
              </Link>
            </p>
          </div>
        ) : null}

        {pageState === "ready" ? (
          <form onSubmit={(event) => void handleSubmit(event)}>
            <p style={{ color: ONE_EYRIE.textMuted, lineHeight: 1.5, marginTop: 0 }}>
              Choose a new password for your One Eyrie account.
            </p>
            {error ? <div style={{ ...noticeStyle, marginBottom: 14 }}>{error}</div> : null}
            <input
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              className="one-eyrie-login-field"
              style={inputStyle}
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              className="one-eyrie-login-field"
              style={inputStyle}
            />
            <button type="submit" disabled={submitting} style={buttonStyle}>
              {submitting ? "Saving…" : "Update password"}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#111111",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial, sans-serif",
  padding: 16,
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#211F1B",
  border: "1px solid #C8A96A",
  borderRadius: 18,
  padding: 32,
};

const inputStyle: CSSProperties = {
  width: "100%",
  marginBottom: 14,
  padding: 14,
  borderRadius: 12,
  fontSize: 15,
  boxSizing: "border-box",
  outline: "none",
};

const buttonStyle: CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 12,
  border: "none",
  background: "#C8A96A",
  color: "#111111",
  fontWeight: 800,
  cursor: "pointer",
};

const noticeStyle: CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  border: `1px solid ${ONE_EYRIE.gold}`,
  background: "rgba(200, 169, 106, 0.12)",
  color: ONE_EYRIE.text,
  fontSize: 14,
};

const linkStyle: CSSProperties = {
  color: ONE_EYRIE.gold,
  textDecoration: "none",
  fontWeight: 700,
};

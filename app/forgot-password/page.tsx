"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

const GENERIC_MESSAGE =
  "If an account exists for that email, you will receive password reset instructions shortly.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // Still show generic success — do not leak delivery failures.
    }

    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <main style={pageStyle}>
      <form onSubmit={(event) => void handleSubmit(event)} style={cardStyle}>
        <OneEyrieWordmark className="one-eyrie-wordmark--sidebar one-eyrie-wordmark--login" />
        <p style={{ color: ONE_EYRIE.gold, marginTop: 0 }}>Forgot password</p>

        {submitted ? (
          <div style={noticeStyle}>
            <p style={{ margin: 0, lineHeight: 1.5 }}>{GENERIC_MESSAGE}</p>
            <p style={{ margin: "14px 0 0", lineHeight: 1.5, color: ONE_EYRIE.textMuted }}>
              Check your inbox and spam folder. The link expires after a short time.
            </p>
          </div>
        ) : (
          <>
            <p style={{ color: ONE_EYRIE.textMuted, lineHeight: 1.5, marginTop: 0 }}>
              Enter the email associated with your One Eyrie account and we&apos;ll send
              reset instructions.
            </p>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="one-eyrie-login-field"
              style={inputStyle}
            />
            <button type="submit" disabled={submitting} style={buttonStyle}>
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}

        <p style={{ marginTop: 18, marginBottom: 0, textAlign: "center" }}>
          <Link href="/login" style={{ color: ONE_EYRIE.gold, textDecoration: "none" }}>
            Back to sign in
          </Link>
        </p>
      </form>
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

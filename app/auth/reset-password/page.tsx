"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Link from "next/link";
import type { AuthError } from "@supabase/supabase-js";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import { waitForInitialAuthSession } from "@/app/lib/auth-session";
import {
  clearPasswordResetSuccess,
  markPasswordResetSucceeded,
  parseRecoverySearchParams,
  passwordResetSucceededInSession,
  recoveryHashIndicatesFailure,
  type RecoveryTokenHash,
} from "@/app/lib/auth/password-reset-recovery";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { supabase } from "@/app/supabaseClient";

type PageState = "loading" | "ready" | "invalid" | "success";

type PendingRecovery =
  | { kind: "token_hash"; tokenHash: string; type: RecoveryTokenHash["type"] }
  | { kind: "recovery_session" };

function readRecoveryParams(): RecoveryTokenHash | null {
  if (typeof window === "undefined") return null;
  return parseRecoverySearchParams(window.location.search);
}

function clearRecoveryParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("token_hash") && !url.searchParams.has("type")) {
    return;
  }
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
}

function logVerifyOtpError(error: AuthError): void {
  console.error("[auth-reset] verifyOtp failed", {
    message: error.message,
    status: error.status,
    code: (error as AuthError & { code?: string }).code ?? null,
    name: error.name,
  });
}

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [pending, setPending] = useState<PendingRecovery | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const successLockRef = useRef(false);

  function applyPageState(next: PageState) {
    if (successLockRef.current || passwordResetSucceededInSession()) {
      successLockRef.current = true;
      setPageState("success");
      return;
    }
    setPageState(next);
  }

  function lockSuccessfulPasswordUpdate() {
    successLockRef.current = true;
    markPasswordResetSucceeded();
    clearRecoveryParamsFromUrl();
    setPageState("success");
  }

  useEffect(() => {
    let mounted = true;
    let recoverySession = false;

    const fromLink = readRecoveryParams();
    if (fromLink) {
      // A fresh recovery link always wins over a prior success marker.
      clearPasswordResetSuccess();
      successLockRef.current = false;
      // Keep the hashed token until the user submits a new password.
      // Do not call verifyOtp on load — prefetchers and Strict Mode remounts
      // would consume the one-time recovery token.
      const readyId = window.setTimeout(() => {
        if (!mounted) return;
        setPending({
          kind: "token_hash",
          tokenHash: fromLink.tokenHash,
          type: fromLink.type,
        });
        applyPageState("ready");
      }, 0);
      return () => {
        mounted = false;
        window.clearTimeout(readyId);
      };
    }

    if (passwordResetSucceededInSession()) {
      successLockRef.current = true;
      const successId = window.setTimeout(() => {
        if (!mounted) return;
        setPageState("success");
      }, 0);
      return () => {
        mounted = false;
        window.clearTimeout(successId);
      };
    }

    if (recoveryHashIndicatesFailure(window.location.hash)) {
      const invalidId = window.setTimeout(() => {
        if (!mounted) return;
        applyPageState("invalid");
      }, 0);
      return () => {
        mounted = false;
        window.clearTimeout(invalidId);
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted || successLockRef.current) return;
      if (event === "PASSWORD_RECOVERY") {
        recoverySession = true;
        setPending({ kind: "recovery_session" });
        applyPageState("ready");
      }
    });

    void waitForInitialAuthSession().then(() => {
      window.setTimeout(() => {
        if (!mounted || recoverySession || successLockRef.current) return;
        setPageState((current) => {
          if (successLockRef.current || current === "success") return "success";
          return current === "loading" ? "invalid" : current;
        });
      }, 400);
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
    if (!pending || submitInFlightRef.current) {
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);

    try {
      if (pending.kind === "token_hash") {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: pending.tokenHash,
          type: pending.type,
        });

        if (verifyError || !data.session) {
          if (verifyError) logVerifyOtpError(verifyError);
          applyPageState("invalid");
          return;
        }

        clearRecoveryParamsFromUrl();
        setPending({ kind: "recovery_session" });
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(
          updateError.message ||
            "Unable to update password. The link may have expired."
        );
        return;
      }

      lockSuccessfulPasswordUpdate();
      await supabase.auth.signOut();
    } finally {
      setSubmitting(false);
      submitInFlightRef.current = false;
    }
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <OneEyrieWordmark className="one-eyrie-wordmark--sidebar one-eyrie-wordmark--login" />

        {pageState === "success" ? (
          <div>
            <h1 style={successHeadingStyle}>Password Changed Successfully</h1>
            <p style={successMessageStyle}>
              Your password has been updated. You can now sign in using your new
              password.
            </p>
            <a
              href="/login"
              style={buttonStyle}
              onClick={() => clearPasswordResetSuccess()}
            >
              Return to Login
            </a>
          </div>
        ) : (
          <p style={{ color: ONE_EYRIE.gold, marginTop: 0 }}>Reset password</p>
        )}

        {pageState === "loading" ? (
          <p style={{ color: ONE_EYRIE.textMuted }}>Checking reset link…</p>
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

        {pageState === "ready" ? (
          <form onSubmit={(event) => void handleSubmit(event)}>
            <p style={{ color: ONE_EYRIE.textMuted, lineHeight: 1.5, marginTop: 0 }}>
              Choose a new password for your One Eyrie account.
            </p>
            {error ? (
              <div style={{ ...noticeStyle, marginBottom: 14 }}>{error}</div>
            ) : null}
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
            <button type="submit" disabled={submitting || !pending} style={buttonStyle}>
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
  display: "block",
  textAlign: "center",
  textDecoration: "none",
  boxSizing: "border-box",
};

const successHeadingStyle: CSSProperties = {
  color: ONE_EYRIE.gold,
  marginTop: 0,
  marginBottom: 14,
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.3,
};

const successMessageStyle: CSSProperties = {
  color: ONE_EYRIE.text,
  lineHeight: 1.5,
  marginTop: 0,
  marginBottom: 22,
  fontSize: 15,
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

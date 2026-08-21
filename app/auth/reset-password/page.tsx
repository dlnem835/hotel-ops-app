"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Link from "next/link";
import type { AuthError, EmailOtpType } from "@supabase/supabase-js";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import {
  ACCOUNT_SETUP_PATH,
  fetchAccountSetupState,
} from "@/app/lib/account-setup/account-setup-client";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { supabase } from "@/app/supabaseClient";

type PageState = "loading" | "confirm" | "ready" | "invalid" | "success";

type PendingRecovery = {
  tokenHash: string;
  type: EmailOtpType;
};

function readRecoveryParams(): PendingRecovery | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get("token_hash")?.trim() || null;
  const rawType = (params.get("type")?.trim() || "recovery") as EmailOtpType;
  if (!tokenHash) return null;
  if (rawType !== "recovery") return null;
  return { tokenHash, type: rawType };
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
  const [verifying, setVerifying] = useState(false);
  const verifyInFlightRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let recoveryDetected = false;
    let unsubscribe: (() => void) | undefined;

    const fromLink = readRecoveryParams();
    if (fromLink) {
      // Do NOT call verifyOtp on mount. Auto-verify is consumed by React Strict
      // Mode remounts and by email-security prefetchers that execute page JS.
      setPending(fromLink);
      setPageState("confirm");
      return () => {
        mounted = false;
      };
    }

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
    unsubscribe = () => subscription.unsubscribe();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  async function handleConfirmRecovery() {
    if (!pending || verifyInFlightRef.current) return;
    verifyInFlightRef.current = true;
    setVerifying(true);
    setError(null);

    console.info("[auth-reset] verifyOtp starting", {
      type: pending.type,
      tokenHashPresent: Boolean(pending.tokenHash),
      tokenHashLength: pending.tokenHash.length,
      queryKeys: Array.from(
        new URLSearchParams(window.location.search).keys()
      ),
    });

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: pending.tokenHash,
      type: pending.type,
    });

    if (verifyError) {
      logVerifyOtpError(verifyError);
      setPageState("invalid");
      setVerifying(false);
      verifyInFlightRef.current = false;
      return;
    }

    console.info("[auth-reset] verifyOtp succeeded", {
      sessionPresent: Boolean(data.session),
      userPresent: Boolean(data.user),
    });

    clearRecoveryParamsFromUrl();
    setPending(null);
    setPageState("ready");
    setVerifying(false);
  }

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
      setError(
        updateError.message || "Unable to update password. The link may have expired."
      );
      return;
    }

    // Invited users who never finished username setup should continue there
    // while still signed in (e.g. recovery after an email-link prefetch).
    const setupState = await fetchAccountSetupState();
    if (setupState && !setupState.accountSetupComplete) {
      window.location.replace(ACCOUNT_SETUP_PATH);
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
          <p style={{ color: ONE_EYRIE.textMuted }}>Checking reset link…</p>
        ) : null}

        {pageState === "confirm" ? (
          <div>
            <p style={{ color: ONE_EYRIE.textMuted, lineHeight: 1.5, marginTop: 0 }}>
              Click below to continue resetting your One Eyrie password. This
              confirms the request and opens the password form.
            </p>
            <button
              type="button"
              disabled={verifying || !pending}
              style={buttonStyle}
              onClick={() => void handleConfirmRecovery()}
            >
              {verifying ? "Verifying…" : "Continue to reset password"}
            </button>
          </div>
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

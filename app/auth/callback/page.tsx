"use client";

import { useEffect, useRef, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { waitForInitialAuthSession } from "@/app/lib/auth-session";
import { completePendingInvitationIfNeeded } from "@/app/lib/invitations/complete-pending-invitation";
import {
  ACCOUNT_SETUP_PATH,
  fetchAccountSetupState,
} from "@/app/lib/account-setup/account-setup-client";
import { resolveAuthenticatedAppHome } from "@/app/lib/resolve-app-home";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import { supabase } from "@/app/supabaseClient";

const SUPPORTED_OTP_TYPES = new Set<EmailOtpType>([
  "invite",
  "magiclink",
  "email",
  "signup",
]);

type PendingInvite = {
  tokenHash: string;
  type: EmailOtpType;
};

type PageState = "loading" | "confirm" | "working" | "error";

function readOtpParams(): PendingInvite | null {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get("token_hash")?.trim() || null;
  const rawType = params.get("type")?.trim() || null;
  if (!tokenHash || !rawType) {
    return null;
  }
  if (!SUPPORTED_OTP_TYPES.has(rawType as EmailOtpType)) {
    return null;
  }
  return { tokenHash, type: rawType as EmailOtpType };
}

function clearOtpParamsFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  window.history.replaceState({}, "", `${url.pathname}${url.hash}`);
}

async function finishAuthenticatedRedirect(setMessage: (value: string) => void) {
  await completePendingInvitationIfNeeded();

  const setupState = await fetchAccountSetupState();
  if (!setupState || !setupState.accountSetupComplete) {
    setMessage("Redirecting to account setup…");
    window.location.replace(ACCOUNT_SETUP_PATH);
    return;
  }

  setMessage("Redirecting…");
  const home = await resolveAuthenticatedAppHome();
  window.location.replace(home);
}

export default function AuthCallbackPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [pending, setPending] = useState<PendingInvite | null>(null);
  const [message, setMessage] = useState("Finishing sign-in…");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const verifyInFlightRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const fromLink = readOtpParams();
      if (fromLink) {
        // Do NOT call verifyOtp on mount. Email security prefetchers (and React
        // Strict Mode remounts) would consume the one-time token before the
        // invitee can finish username setup — same pattern as /auth/reset-password.
        setPending(fromLink);
        setPageState("confirm");
        return;
      }

      const session = await waitForInitialAuthSession();
      if (!mounted) return;

      if (!session) {
        window.location.replace("/login");
        return;
      }

      setPageState("working");
      setMessage("Finishing sign-in…");
      try {
        await finishAuthenticatedRedirect(setMessage);
      } catch {
        if (!mounted) return;
        setError("Unable to finish sign-in. Please try again from your invitation email.");
        setPageState("error");
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleConfirmInvite() {
    if (!pending || verifyInFlightRef.current) return;
    verifyInFlightRef.current = true;
    setVerifying(true);
    setError(null);
    setPageState("working");
    setMessage("Accepting invitation…");

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: pending.tokenHash,
      type: pending.type,
    });
    clearOtpParamsFromUrl();
    setPending(null);

    if (verifyError) {
      setError(
        verifyError.message?.toLowerCase().includes("expired") ||
          verifyError.message?.toLowerCase().includes("invalid")
          ? "This invitation link is invalid or has expired. Ask your administrator to resend it."
          : "Unable to accept this invitation. Please request a new invite."
      );
      setPageState("error");
      setVerifying(false);
      verifyInFlightRef.current = false;
      return;
    }

    try {
      await finishAuthenticatedRedirect(setMessage);
    } catch {
      setError("Invitation accepted, but account setup could not start. Try signing in again.");
      setPageState("error");
      setVerifying(false);
      verifyInFlightRef.current = false;
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111111",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 16,
      }}
    >
      <OneEyrieWordmark />

      {pageState === "loading" ? (
        <p style={{ color: ONE_EYRIE.textMuted, margin: 0 }}>{message}</p>
      ) : null}

      {pageState === "confirm" ? (
        <div
          style={{
            width: 420,
            maxWidth: "100%",
            background: ONE_EYRIE.surface,
            border: `1px solid ${ONE_EYRIE.gold}`,
            borderRadius: 18,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <p style={{ color: ONE_EYRIE.gold, margin: 0, fontWeight: 700 }}>
            Accept your invitation
          </p>
          <p style={{ color: ONE_EYRIE.textMuted, margin: 0, lineHeight: 1.5, fontSize: 14 }}>
            Continue to join One Eyrie. Next you&apos;ll choose your username and
            password.
          </p>
          <button
            type="button"
            disabled={verifying || !pending}
            onClick={() => void handleConfirmInvite()}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              border: "none",
              background: ONE_EYRIE.gold,
              color: "#111111",
              fontWeight: 800,
              cursor: verifying || !pending ? "default" : "pointer",
              opacity: verifying || !pending ? 0.7 : 1,
            }}
          >
            {verifying ? "Verifying…" : "Continue to account setup"}
          </button>
        </div>
      ) : null}

      {pageState === "working" ? (
        <p style={{ color: ONE_EYRIE.textMuted, margin: 0 }}>{message}</p>
      ) : null}

      {pageState === "error" ? (
        <div
          style={{
            width: 420,
            maxWidth: "100%",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #8B5252",
            background: "rgba(139,82,82,0.15)",
            color: ONE_EYRIE.text,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      ) : null}
    </main>
  );
}

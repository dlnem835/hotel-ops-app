"use client";

import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { waitForInitialAuthSession } from "@/app/lib/auth-session";
import { completePendingInvitationIfNeeded } from "@/app/lib/invitations/complete-pending-invitation";
import {
  ACCOUNT_SETUP_PATH,
  fetchAccountSetupState,
} from "@/app/lib/account-setup/account-setup-client";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import { supabase } from "@/app/supabaseClient";

const SUPPORTED_OTP_TYPES = new Set<EmailOtpType>([
  "invite",
  "magiclink",
  "email",
  "signup",
]);

function readOtpParams(): { tokenHash: string | null; type: EmailOtpType | null } {
  if (typeof window === "undefined") {
    return { tokenHash: null, type: null };
  }
  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get("token_hash")?.trim() || null;
  const rawType = params.get("type")?.trim() || null;
  if (!tokenHash || !rawType) {
    return { tokenHash: null, type: null };
  }
  if (!SUPPORTED_OTP_TYPES.has(rawType as EmailOtpType)) {
    return { tokenHash, type: null };
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

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let mounted = true;

    async function run() {
      const { tokenHash, type } = readOtpParams();

      if (tokenHash && type) {
        setMessage("Accepting invitation…");
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        clearOtpParamsFromUrl();
        if (!mounted) return;
        if (error) {
          setMessage(
            error.message?.toLowerCase().includes("expired") ||
              error.message?.toLowerCase().includes("invalid")
              ? "This invitation link is invalid or has expired."
              : "Unable to accept this invitation. Please request a new invite."
          );
          window.setTimeout(() => {
            window.location.replace("/login");
          }, 2500);
          return;
        }
      }

      const session = await waitForInitialAuthSession();

      if (!mounted) return;

      if (!session) {
        window.location.replace("/login");
        return;
      }

      await completePendingInvitationIfNeeded();

      const setupState = await fetchAccountSetupState();
      if (!mounted) return;

      if (!setupState || !setupState.accountSetupComplete) {
        setMessage("Redirecting to account setup…");
        window.location.replace(ACCOUNT_SETUP_PATH);
        return;
      }

      setMessage("Redirecting…");
      window.location.replace("/");
    }

    void run();

    return () => {
      mounted = false;
    };
  }, []);

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
      <p style={{ color: ONE_EYRIE.textMuted, margin: 0 }}>{message}</p>
    </main>
  );
}

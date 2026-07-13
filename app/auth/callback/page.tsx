"use client";

import { useEffect, useState } from "react";
import { waitForInitialAuthSession } from "@/app/lib/auth-session";
import { completePendingInvitationIfNeeded } from "@/app/lib/invitations/complete-pending-invitation";
import {
  ACCOUNT_SETUP_PATH,
  fetchAccountSetupState,
} from "@/app/lib/account-setup/account-setup-client";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let mounted = true;

    async function run() {
      const session = await waitForInitialAuthSession();

      if (!mounted) return;

      if (!session) {
        window.location.replace("/login");
        return;
      }

      // Establish org/property membership from the invitation, if pending.
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
        gap: "18px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <OneEyrieWordmark className="one-eyrie-wordmark--sidebar" />
      <p style={{ color: ONE_EYRIE.textMuted }}>{message}</p>
    </main>
  );
}

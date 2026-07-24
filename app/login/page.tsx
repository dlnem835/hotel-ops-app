"use client";

import { useEffect, useRef, useState } from "react";
import {
  confirmPersistedSession,
  waitForInitialAuthSession,
} from "@/app/lib/auth-session";
import { consumeInactivityLogoutMessage } from "@/app/lib/inactivity-logout";
import { completePendingInvitationIfNeeded } from "@/app/lib/invitations/complete-pending-invitation";
import {
  ACCOUNT_SETUP_PATH,
  fetchAccountSetupState,
} from "@/app/lib/account-setup/account-setup-client";
import { resolveStaffLoginEmail } from "@/app/lib/login-email";
import {
  captureLoginReturnFromUrl,
  consumeExplicitLoginRedirect,
} from "@/app/lib/login-return";
import { resolveAuthenticatedAppHome } from "@/app/lib/resolve-app-home";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { supabase } from "@/app/supabaseClient";

/**
 * Completes any pending invitation, then routes based on account-setup state.
 * Invited users who have not finished first-login setup are sent to the setup
 * page (UX); server routes independently enforce the same gate.
 *
 * Destination shell (mobile vs desktop) follows viewport-interface Automatic
 * rules: phone → /mobile, tablet (iPad) + desktop → desktop shell.
 */
async function resolvePostAuthTarget(): Promise<string> {
  await completePendingInvitationIfNeeded();

  const setupState = await fetchAccountSetupState();
  if (setupState && !setupState.accountSetupComplete) {
    return ACCOUNT_SETUP_PATH;
  }

  return resolveAuthenticatedAppHome({
    explicitTarget: consumeExplicitLoginRedirect(),
  });
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);
  const [authDebug, setAuthDebug] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    captureLoginReturnFromUrl();
    setLogoutMessage(consumeInactivityLogoutMessage());

    let mounted = true;

    void waitForInitialAuthSession().then(async (session) => {
      if (!mounted || !session || submittingRef.current) return;
      const target = await resolvePostAuthTarget();
      window.location.replace(target);
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    submittingRef.current = true;
    setAuthDebug("Signing in…");

    const authEmail = resolveStaffLoginEmail(username);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (error) {
      submittingRef.current = false;
      setAuthDebug(`Login failed: ${error.message}`);
      return;
    }

    if (!data.session) {
      submittingRef.current = false;
      setAuthDebug("Login failed: No session returned from Supabase.");
      return;
    }

    const session = confirmPersistedSession(data.session);

    if (!session) {
      submittingRef.current = false;
      setAuthDebug("Login failed: Session was not persisted.");
      return;
    }

    // Disabled hotel accounts may still hold a JWT after membership deactivation.
    // Refuse login when tenant APIs report the account disabled.
    const tenantResponse = await fetch("/api/tenant/context", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (tenantResponse.status === 403) {
      const body = (await tenantResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (body?.error === "Account disabled") {
        await supabase.auth.signOut();
        submittingRef.current = false;
        setAuthDebug("Login failed: This account has been disabled.");
        return;
      }
    }

    const target = await resolvePostAuthTarget();
    setAuthDebug(`Session created, redirecting… → ${target}`);
    window.location.assign(target);
  }

  return (
    <main className="one-eyrie-auth-page">
      <form
        onSubmit={(event) => void handleLogin(event)}
        className="one-eyrie-auth-card"
      >
        <OneEyrieWordmark className="one-eyrie-wordmark--sidebar one-eyrie-wordmark--login" />
        <p className="one-eyrie-auth-card__eyebrow">Staff Login</p>

        {logoutMessage && (
          <div
            className="one-eyrie-auth-notice"
            style={{
              borderColor: ONE_EYRIE.gold,
              background: "rgba(200, 169, 106, 0.12)",
              color: ONE_EYRIE.text,
            }}
          >
            {logoutMessage}
          </div>
        )}

        {authDebug ? (
          <div className="one-eyrie-auth-notice one-eyrie-auth-notice--debug">
            {authDebug}
          </div>
        ) : null}

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username or email"
          autoComplete="username"
          className="one-eyrie-login-field one-eyrie-auth-field"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="one-eyrie-login-field one-eyrie-auth-field"
        />

        <button type="submit" className="one-eyrie-auth-submit">
          Sign In
        </button>

        <p className="one-eyrie-auth-footer">
          <a href="/forgot-password" className="one-eyrie-auth-link">
            Forgot password?
          </a>
        </p>
      </form>
    </main>
  );
}

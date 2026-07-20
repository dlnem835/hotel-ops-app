"use client";

import { useEffect, useRef, useState } from "react";
import { waitForInitialAuthSession } from "@/app/lib/auth-session";
import { fetchAccountSetupState } from "@/app/lib/account-setup/account-setup-client";
import {
  PASSWORD_MIN_LENGTH,
  validatePassword,
  validateUsername,
} from "@/app/lib/account-setup/username";
import { resolveAuthenticatedAppHome } from "@/app/lib/resolve-app-home";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import { supabase } from "@/app/supabaseClient";

export default function OnboardingAccountPage() {
  const [ready, setReady] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const session = await waitForInitialAuthSession();
      if (!mounted) return;

      if (!session) {
        window.location.replace("/login");
        return;
      }

      const state = await fetchAccountSetupState();
      if (!mounted) return;

      if (state?.accountSetupComplete) {
        const home = await resolveAuthenticatedAppHome();
        window.location.replace(home);
        return;
      }

      if (state) {
        setFirstName(state.firstName ?? "");
        setLastName(state.lastName ?? "");
      }
      setReady(true);
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submittingRef.current) return;

    setError(null);

    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (!lastName.trim()) {
      setError("Last name is required");
      return;
    }

    const usernameResult = validateUsername(username);
    if (!usernameResult.ok) {
      setError(usernameResult.error);
      return;
    }

    const passwordResult = validatePassword(password, confirmPassword);
    if (!passwordResult.ok) {
      setError(passwordResult.error);
      return;
    }

    submittingRef.current = true;
    setStatus("Saving your account…");

    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      submittingRef.current = false;
      setStatus(null);
      setError(`Could not set password: ${passwordError.message}`);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/onboarding/account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: usernameResult.normalized,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      submittingRef.current = false;
      setStatus(null);
      setError(body?.error ?? `Setup failed (${response.status})`);
      return;
    }

    setStatus("Account ready. Redirecting…");
    const home = await resolveAuthenticatedAppHome();
    window.location.assign(home);
  }

  if (!ready) {
    return (
      <main style={pageStyle}>
        <p style={{ color: ONE_EYRIE.textMuted }}>Loading account setup…</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <form onSubmit={handleSubmit} style={cardStyle}>
        <OneEyrieWordmark className="one-eyrie-wordmark--sidebar one-eyrie-wordmark--login" />
        <h1 style={{ color: ONE_EYRIE.gold, fontSize: 20, margin: "8px 0 4px" }}>
          Finish setting up your account
        </h1>
        <p style={{ color: ONE_EYRIE.textMuted, marginTop: 0, fontSize: 14 }}>
          Choose your username and password to continue.
        </p>

        {error ? (
          <div style={noticeStyle("#8B5252", "rgba(139,82,82,0.15)")}>{error}</div>
        ) : null}
        {status ? (
          <div style={noticeStyle(ONE_EYRIE.gold, "rgba(200,169,106,0.12)")}>
            {status}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>First name</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={inputStyle}
              autoComplete="given-name"
            />
          </label>
          <label style={{ flex: 1 }}>
            <span style={labelStyle}>Last name</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={inputStyle}
              autoComplete="family-name"
            />
          </label>
        </div>

        <label>
          <span style={labelStyle}>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            autoComplete="username"
            placeholder="e.g. jsmith"
          />
        </label>

        <label>
          <span style={labelStyle}>New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete="new-password"
            placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
          />
        </label>

        <label>
          <span style={labelStyle}>Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
            autoComplete="new-password"
          />
        </label>

        <button type="submit" style={submitStyle}>
          Complete setup
        </button>
      </form>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111111",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
};

const cardStyle: React.CSSProperties = {
  width: "460px",
  maxWidth: "100%",
  background: ONE_EYRIE.surface,
  border: `1px solid ${ONE_EYRIE.gold}`,
  borderRadius: "18px",
  padding: "28px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: ONE_EYRIE.textMuted,
  fontSize: "13px",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: `1px solid ${ONE_EYRIE.borderInput}`,
  background: ONE_EYRIE.surfaceInset,
  color: "#fff",
  fontSize: "15px",
  boxSizing: "border-box",
  outline: "none",
};

const submitStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "none",
  background: ONE_EYRIE.gold,
  color: "#111111",
  fontWeight: 800,
  cursor: "pointer",
  marginTop: "4px",
};

function noticeStyle(border: string, background: string): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: "10px",
    border: `1px solid ${border}`,
    background,
    color: ONE_EYRIE.text,
    fontSize: "13px",
    lineHeight: 1.45,
  };
}

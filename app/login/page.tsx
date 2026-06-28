"use client";

import { useEffect, useRef, useState } from "react";
import {
  confirmPersistedSession,
  waitForInitialAuthSession,
} from "@/app/lib/auth-session";
import { consumeInactivityLogoutMessage } from "@/app/lib/inactivity-logout";
import {
  captureLoginReturnFromUrl,
  consumeLoginRedirect,
} from "@/app/lib/login-return";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { supabase } from "@/app/supabaseClient";

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

    void waitForInitialAuthSession().then((session) => {
      if (!mounted || !session || submittingRef.current) return;
      window.location.replace(consumeLoginRedirect());
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    submittingRef.current = true;
    setAuthDebug("Signing in…");

    const authEmail = `${username.trim()}@oneeyrie.local`;

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

    const target = consumeLoginRedirect();
    setAuthDebug(`Session created, redirecting… → ${target}`);
    window.location.assign(target);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111111",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <form
        onSubmit={(event) => void handleLogin(event)}
        style={{
          width: "420px",
          background: "#211F1B",
          border: "1px solid #C8A96A",
          borderRadius: "18px",
          padding: "32px",
        }}
      >
        <h1 style={{ marginTop: 0 }}>One Eyrie</h1>
        <p style={{ color: "#C8A96A" }}>Staff Login</p>

        {logoutMessage && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              borderRadius: "10px",
              border: `1px solid ${ONE_EYRIE.gold}`,
              background: "rgba(200, 169, 106, 0.12)",
              color: ONE_EYRIE.text,
              fontSize: "14px",
              lineHeight: 1.45,
            }}
          >
            {logoutMessage}
          </div>
        )}

        {authDebug ? (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 14px",
              borderRadius: "10px",
              border: "1px solid rgba(200,169,106,0.5)",
              background: "rgba(0,0,0,0.25)",
              color: ONE_EYRIE.text,
              fontSize: "13px",
              lineHeight: 1.45,
            }}
          >
            {authDebug}
          </div>
        ) : null}

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          style={inputStyle}
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={inputStyle}
        />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: "#C8A96A",
            color: "#111111",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Sign In
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginBottom: "14px",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid rgba(200,169,106,0.35)",
  background: "#302D28",
  color: "#fff",
  fontSize: "15px",
};

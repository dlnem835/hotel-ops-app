"use client";

import { createClient } from "@supabase/supabase-js";
import { useState } from "react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    const authEmail = `${username.trim()}@oneeyrie.local`;

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "/pass-on-log";
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
        onSubmit={handleLogin}
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
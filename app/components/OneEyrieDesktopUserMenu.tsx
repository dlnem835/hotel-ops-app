"use client";

import { useEffect, useState } from "react";
import { signOutAndRedirect } from "@/app/lib/auth";
import { supabase } from "@/app/supabaseClient";

export default function OneEyrieDesktopUserMenu() {
  const [username, setUsername] = useState("Unknown");

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: teamMember } = await supabase
        .from("team_members")
        .select("username")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (teamMember?.username) {
        setUsername(teamMember.username);
      }
    }

    void load();
  }, []);

  return (
    <div className="one-eyrie-desktop-user-menu">
      <div className="one-eyrie-desktop-user-menu__name">{username}</div>
      <button
        type="button"
        onClick={() => void signOutAndRedirect()}
        className="one-eyrie-text-btn one-eyrie-desktop-user-menu__logout"
      >
        Logout
      </button>
    </div>
  );
}

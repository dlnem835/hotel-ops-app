"use client";

import { useEffect, useState } from "react";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import { supabase } from "@/app/supabaseClient";

export type CurrentUserProfile = {
  displayName: string;
  jobTitle: string;
  initials: string;
};

function buildDisplayName(input: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string {
  const fullName = `${input.firstName || ""} ${input.lastName || ""}`.trim();
  if (fullName) return fullName;
  if (input.username?.trim()) return input.username.trim();
  return "User";
}

function buildInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export function useCurrentUserProfile(): {
  profile: CurrentUserProfile | null;
  loading: boolean;
} {
  const { access, loading: accessLoading } = useRoleAccess();
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [loadingMember, setLoadingMember] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (mounted) {
          setProfile(null);
          setLoadingMember(false);
        }
        return;
      }

      const { data: teamMember } = await supabase
        .from("team_members")
        .select("first_name, last_name, username, job_title")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      const displayName = buildDisplayName({
        firstName: teamMember?.first_name,
        lastName: teamMember?.last_name,
        username: teamMember?.username,
      });

      setProfile({
        displayName,
        jobTitle:
          teamMember?.job_title?.trim() ||
          access?.jobTitle?.trim() ||
          "Team Member",
        initials: buildInitials(displayName),
      });
      setLoadingMember(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [access?.jobTitle]);

  return {
    profile,
    loading: accessLoading || loadingMember,
  };
}

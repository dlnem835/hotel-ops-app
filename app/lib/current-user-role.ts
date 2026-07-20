import {
  buildUserAccessProfile,
  UserAccessProfile,
} from "@/app/lib/role-permissions";
import { supabase } from "@/app/supabaseClient";

type TeamMemberAccessRow = {
  job_title?: string | null;
  role?: string | null;
  is_administrator?: boolean | null;
  module_permissions?: Record<string, boolean> | null;
};

export async function fetchTeamMemberAccess(): Promise<UserAccessProfile | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const { data, error } = await supabase
    .from("team_members")
    .select("job_title, role, is_administrator, module_permissions, can_login, status")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();

  if (error || !data) {
    const metadataRole = session.user.user_metadata?.role;
    if (typeof metadataRole === "string" && metadataRole.trim()) {
      return buildUserAccessProfile({ legacyRole: metadataRole });
    }
    return null;
  }

  const row = data as TeamMemberAccessRow & {
    can_login?: boolean | null;
    status?: string | null;
  };

  if (row.can_login === false || row.status === "Inactive") {
    return null;
  }

  return buildUserAccessProfile({
    jobTitle: row.job_title,
    legacyRole: row.role,
    isAdministrator: row.is_administrator,
    modulePermissions: row.module_permissions,
  });
}

/** @deprecated Use fetchTeamMemberAccess */
export async function fetchTeamMemberRole() {
  const access = await fetchTeamMemberAccess();
  return access;
}

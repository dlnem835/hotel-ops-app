import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getAdministratorPermissions,
  normalizeModulePermissions,
} from "@/app/lib/role-permissions";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function resolveStoredPermissions(
  isAdministrator: boolean,
  modulePermissions: unknown
) {
  if (isAdministrator) {
    return getAdministratorPermissions();
  }
  return normalizeModulePermissions(
    modulePermissions as Record<string, boolean> | null | undefined
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      first_name,
      last_name,
      email,
      phone,
      department,
      job_title,
      role,
      is_administrator,
      module_permissions,
      status,
      can_login,
      username,
      tempPassword,
    } = body;

    const jobTitle = String(job_title || role || "").trim();
    const isAdministrator = Boolean(is_administrator);
    const permissions = resolveStoredPermissions(
      isAdministrator,
      module_permissions
    );

    const supabaseAdmin = getSupabaseAdmin();

    let authUserId = null;
    let authEmail = null;

    if (can_login && username && tempPassword) {
      authEmail = `${username}@oneeyrie.local`;

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: authEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            first_name,
            last_name,
            job_title: jobTitle,
            is_administrator: isAdministrator,
            username,
          },
        });

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }

      authUserId = authData.user.id;
    }

    const { data, error } = await supabaseAdmin
      .from("team_members")
      .insert([
        {
          first_name,
          last_name,
          email,
          phone,
          department: department ?? null,
          job_title: jobTitle || null,
          role: jobTitle || null,
          is_administrator: isAdministrator,
          module_permissions: permissions,
          status,
          can_login,
          username: username || null,
          auth_email: authEmail,
          auth_user_id: authUserId,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const {
      id,
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

    if (!id) {
      return NextResponse.json({ error: "User id is required" }, { status: 400 });
    }

    const jobTitle = String(job_title || role || "").trim();
    const isAdministrator = Boolean(is_administrator);
    const permissions = resolveStoredPermissions(
      isAdministrator,
      module_permissions
    );

    const supabaseAdmin = getSupabaseAdmin();

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("team_members")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: fetchError?.message || "Team member not found" },
        { status: 404 }
      );
    }

    let authUserId = existing.auth_user_id;
    let authEmail = existing.auth_email;

    if (can_login && username) {
      if (!authUserId && tempPassword) {
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
      } else if (authUserId) {
        const authUpdates: {
          password?: string;
          user_metadata: Record<string, string | boolean>;
        } = {
          user_metadata: {
            first_name,
            last_name,
            job_title: jobTitle,
            is_administrator: isAdministrator,
            username,
          },
        };

        if (tempPassword) {
          authUpdates.password = tempPassword;
        }

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          authUserId,
          authUpdates
        );

        if (authError) {
          return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        if (username) {
          authEmail = `${username}@oneeyrie.local`;
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from("team_members")
      .update({
        first_name,
        last_name,
        email,
        phone,
        ...(department !== undefined ? { department: department ?? null } : {}),
        job_title: jobTitle || null,
        role: jobTitle || null,
        is_administrator: isAdministrator,
        module_permissions: permissions,
        status,
        can_login,
        username: can_login && username ? username : existing.username,
        auth_email: authEmail ?? existing.auth_email,
        auth_user_id: authUserId ?? existing.auth_user_id,
      })
      .eq("id", id)
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

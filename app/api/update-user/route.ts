import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
      role,
      status,
      can_login,
      username,
      tempPassword,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "User id is required" }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
              role,
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
          user_metadata: Record<string, string>;
        } = {
          user_metadata: {
            first_name,
            last_name,
            role,
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
        department,
        role,
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}

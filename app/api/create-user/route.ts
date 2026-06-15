import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
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

    console.log("URL EXISTS:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("SERVICE KEY EXISTS:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
            role,
            username,
          },
        });

      if (authError) {
        console.log("AUTH ERROR:", authError);
        return NextResponse.json(
          { error: authError.message },
          { status: 500 }
        );
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
          department,
          role,
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
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ user: data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
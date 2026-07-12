/**
 * Shared auth helper for tenant verification scripts.
 */

import { createClient } from "@supabase/supabase-js";

export async function getAccessToken(admin, userId) {
  const email = (await admin.auth.admin.getUserById(userId)).data.user.email;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(error?.message || "Unable to create auth link");
  }
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data: sessionData, error: sessionError } = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error(sessionError?.message || "Unable to verify OTP");
  }
  return sessionData.session.access_token;
}

export async function findTeamManagerAuthUserId(admin, organizationId, propertyId) {
  const { data: managerRows } = await admin
    .from("team_members")
    .select("auth_user_id, is_administrator, module_permissions, job_title")
    .not("auth_user_id", "is", null)
    .eq("organization_id", organizationId)
    .eq("property_id", propertyId);

  const manager = (managerRows ?? []).find((row) => {
    const permissions = row.module_permissions;
    const jobTitle = String(row.job_title || "").trim();
    return (
      row.is_administrator ||
      permissions?.settings === true ||
      jobTitle === "General Manager" ||
      jobTitle === "Assistant General Manager"
    );
  });

  return manager?.auth_user_id ?? null;
}

export function pass(label) {
  console.log(`OK    ${label}`);
  return 0;
}

export function fail(label, detail) {
  console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  return 1;
}

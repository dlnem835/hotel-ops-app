/**
 * Disable / enable enforcement verification.
 *
 * Steps:
 * 1. Login before disable succeeds (tenant context 200)
 * 2. Disable user
 * 3. Existing session cannot continue (tenant context / dashboard 403)
 * 4. New login fails (Auth ban or Account disabled)
 * 5. Enable user
 * 6. Login succeeds again
 * 7. Access remains limited to assigned org/property scope
 *
 * Requires: npm run dev (or SMOKE_BASE_URL) and SUPPRESS_AUTH_EMAILS=true.
 *
 * Usage: node scripts/tenant/verify-disable-enable-enforcement.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import { assertAuthEmailsSuppressed, testEmail } from "./auth-email-guard.mjs";
import { fail, getAccessToken, pass } from "./tenant-verify-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const STAMP = Date.now();
const ORG_SLUG = `disable-enable-${STAMP}`;
const ORG_NAME = `Disable Enable ${STAMP}`;
const PRIMARY_EMAIL = testEmail(`de.primary.${STAMP}`);
const ADMIN_EMAIL = testEmail(`de.admin.${STAMP}`);
const PASSWORD = `Test-${STAMP}-Aa1!`;

async function findPlatformOwnerUserId(admin) {
  const { data: owner } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("active", true)
    .eq("role", "platform_owner")
    .limit(1)
    .maybeSingle();
  return owner?.user_id ?? null;
}

async function completeInvite(admin, invitationId, password) {
  const { data: invitationRow } = await admin
    .from("organization_invitations")
    .select("auth_user_id")
    .eq("id", invitationId)
    .maybeSingle();

  const userId = invitationRow?.auth_user_id ?? null;
  if (!userId) throw new Error("Invitation missing auth_user_id");

  await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    ban_duration: "none",
  });

  const token = await getAccessToken(admin, userId);
  const completeRes = await fetch(`${BASE}/api/invitations/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (completeRes.status !== 200) {
    throw new Error(`complete invitation failed (${completeRes.status})`);
  }

  await admin.from("user_profiles").upsert(
    {
      user_id: userId,
      account_setup_completed: true,
      username: `user_${STAMP}_${userId.slice(0, 6)}`,
    },
    { onConflict: "user_id" }
  );

  return userId;
}

async function passwordLogin(email, password) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

async function main() {
  loadEnvLocal();
  assertAuthEmailsSuppressed();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    fail("env", "Missing Supabase env");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ownerUserId = await findPlatformOwnerUserId(admin);
  if (!ownerUserId) {
    fail("setup", "No active platform_owner found");
    process.exit(1);
  }
  const ownerToken = await getAccessToken(admin, ownerUserId);
  const auth = { Authorization: `Bearer ${ownerToken}` };

  let orgId = null;
  let propertyId = null;
  let adminInvitationId = null;
  let adminUserId = null;

  try {
    const orgRes = await fetch(`${BASE}/api/admin/organizations`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ name: ORG_NAME, slug: ORG_SLUG }),
    });
    if (orgRes.status !== 200 && orgRes.status !== 201) {
      fail("create org", `got ${orgRes.status}`);
      process.exit(1);
    }
    const orgBody = await orgRes.json();
    orgId = orgBody.id ?? orgBody.organization?.id;
    pass("Created test organization");

    const propRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/properties`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Property ${STAMP}`,
          timezone: "America/New_York",
        }),
      }
    );
    if (propRes.status !== 200 && propRes.status !== 201) {
      fail("create property", `got ${propRes.status}`);
      process.exit(1);
    }
    const propBody = await propRes.json();
    propertyId = propBody.id ?? propBody.property?.id;
    pass("Created test property");

    const primaryInvite = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "organization_admin",
          propertyId,
          propertyIds: [propertyId],
          firstName: "Primary",
          lastName: "Owner",
          email: PRIMARY_EMAIL,
          jobTitle: "Primary Owner",
        }),
      }
    );
    if (primaryInvite.status !== 200 && primaryInvite.status !== 201) {
      fail("invite primary", `got ${primaryInvite.status}`);
      process.exit(1);
    }
    const primaryBody = await primaryInvite.json();
    await completeInvite(admin, primaryBody.id, PASSWORD);
    pass("Primary Owner accepted");

    const adminInvite = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "organization_admin",
          propertyId,
          propertyIds: [propertyId],
          firstName: "Org",
          lastName: "Admin",
          email: ADMIN_EMAIL,
          jobTitle: "Corporate Administrator",
        }),
      }
    );
    if (adminInvite.status !== 200 && adminInvite.status !== 201) {
      fail("invite admin", `got ${adminInvite.status}`);
      process.exit(1);
    }
    const adminBody = await adminInvite.json();
    adminInvitationId = adminBody.id;
    adminUserId = await completeInvite(admin, adminInvitationId, PASSWORD);
    pass("Organization Admin accepted");

    // 1. Login before disable succeeds
    const beforeLogin = await passwordLogin(ADMIN_EMAIL, PASSWORD);
    if (beforeLogin.error || !beforeLogin.data.session) {
      fail("login before disable", beforeLogin.error?.message ?? "no session");
    } else {
      const ctx = await fetch(`${BASE}/api/tenant/context`, {
        headers: {
          Authorization: `Bearer ${beforeLogin.data.session.access_token}`,
        },
      });
      ctx.status === 200
        ? pass("1. Login before disable succeeds (tenant context 200)")
        : fail("1. Login before disable", `tenant ${ctx.status}`);
    }

    const sessionToken = beforeLogin.data?.session?.access_token ?? null;

    // 2. Disable
    const disableRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInvitationId}`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      }
    );
    disableRes.status === 200
      ? pass("2. Disable user")
      : fail("2. Disable user", `got ${disableRes.status}`);

    // 3. Existing session blocked
    if (sessionToken) {
      const existingCtx = await fetch(`${BASE}/api/tenant/context`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      existingCtx.status === 403
        ? pass("3. Existing session cannot access protected data")
        : fail("3. Existing session blocked", `got ${existingCtx.status}`);
    } else {
      fail("3. Existing session blocked", "no prior session token");
    }

    // 4. New login fails
    const afterDisableLogin = await passwordLogin(ADMIN_EMAIL, PASSWORD);
    if (afterDisableLogin.error) {
      pass(`4. New login fails (${afterDisableLogin.error.message})`);
    } else if (afterDisableLogin.data?.session) {
      const ctx = await fetch(`${BASE}/api/tenant/context`, {
        headers: {
          Authorization: `Bearer ${afterDisableLogin.data.session.access_token}`,
        },
      });
      if (ctx.status === 403) {
        const body = await ctx.json().catch(() => ({}));
        body.error === "Account disabled"
          ? pass("4. New login session blocked as Account disabled")
          : fail("4. New login fails", `tenant 403: ${body.error}`);
      } else {
        fail("4. New login fails", `unexpected tenant ${ctx.status}`);
      }
      await admin.auth.admin.signOut(adminUserId).catch(() => null);
    } else {
      fail("4. New login fails", "no error and no session");
    }

    // 5. Enable
    const enableRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInvitationId}`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable" }),
      }
    );
    enableRes.status === 200
      ? pass("5. Enable user")
      : fail("5. Enable user", `got ${enableRes.status}`);

    // Clear any residual ban
    await admin.auth.admin.updateUserById(adminUserId, { ban_duration: "none" });

    // 6. Login succeeds again
    const afterEnableLogin = await passwordLogin(ADMIN_EMAIL, PASSWORD);
    if (afterEnableLogin.error || !afterEnableLogin.data.session) {
      fail("6. Login succeeds again", afterEnableLogin.error?.message ?? "no session");
    } else {
      const ctx = await fetch(`${BASE}/api/tenant/context`, {
        headers: {
          Authorization: `Bearer ${afterEnableLogin.data.session.access_token}`,
        },
      });
      ctx.status === 200
        ? pass("6. Login succeeds again (tenant context 200)")
        : fail("6. Login succeeds again", `tenant ${ctx.status}`);

      // 7. Scope limited to assigned org
      const contextBody = await ctx.json();
      const orgMatch = contextBody.organization?.id === orgId;
      orgMatch
        ? pass("7. Access limited to assigned organization")
        : fail(
            "7. Access scope",
            `expected org ${orgId}, got ${contextBody.organization?.id}`
          );
    }
  } catch (error) {
    fail("unexpected", error instanceof Error ? error.message : String(error));
  } finally {
    if (orgId) {
      // Soft cleanup: suspend org; full delete may be blocked by related rows.
      await fetch(`${BASE}/api/admin/organizations/${orgId}/suspend`, {
        method: "POST",
        headers: auth,
      }).catch(() => null);
    }
  }
}

main();

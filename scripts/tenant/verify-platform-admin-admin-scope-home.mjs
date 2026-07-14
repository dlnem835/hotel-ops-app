/**
 * Platform admin — revised Role / Scope / property assignment verification.
 *
 * Organization Admin = selected properties only (user_properties).
 * Primary Owner = entire organization (including future properties).
 * Property Administrator = exactly one property.
 *
 * Requires: npm run dev + SUPPRESS_AUTH_EMAILS=true
 *
 * Usage: node scripts/tenant/verify-platform-admin-admin-scope-home.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import { assertAuthEmailsSuppressed, testEmail } from "./auth-email-guard.mjs";
import { fail, getAccessToken, pass } from "./tenant-verify-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const STAMP = Date.now();
const TEST_ORG_SLUG = `scope-home-verify-${STAMP}`;
const TEST_ORG_NAME = `Scope Home Verify ${STAMP}`;
const PRIMARY_EMAIL = testEmail(`scope.primary.${STAMP}`);
const ORG_ADMIN_EMAIL = testEmail(`scope.orgadmin.${STAMP}`);
const PROP_ADMIN_EMAIL = testEmail(`scope.propadmin.${STAMP}`);

async function findPlatformAdminUserId(admin) {
  const { data: owner } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("active", true)
    .eq("role", "platform_owner")
    .limit(1)
    .maybeSingle();
  if (owner?.user_id) return owner.user_id;
  const { data: anyAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return anyAdmin?.user_id ?? null;
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
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return userId;
}

async function createProperty(authHeaders, orgId, name) {
  const res = await fetch(`${BASE}/api/admin/organizations/${orgId}/properties`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name,
      address: "1 Scope Lane",
      timezone: "America/New_York",
    }),
  });
  if (res.status !== 201) {
    throw new Error(`create property failed (${res.status})`);
  }
  return (await res.json()).id;
}

async function inviteAdmin(authHeaders, orgId, body) {
  const res = await fetch(`${BASE}/api/admin/organizations/${orgId}/invitations`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
  });
  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`invite failed (${res.status}): ${text}`);
  }
  return res.json();
}

function allModules(enabled = true) {
  return {
    dashboard: enabled,
    reports: enabled,
    lost_found: enabled,
    pass_on: enabled,
    inspections: enabled,
    maintenance: enabled,
    settings: enabled,
  };
}

async function main() {
  loadEnvLocal();
  assertAuthEmailsSuppressed();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey);
  let failures = 0;
  const cleanup = [];
  let orgId = null;
  const propertyIds = [];
  let primaryUserId = null;
  let orgAdminUserId = null;
  let propAdminUserId = null;
  let primaryInviteId = null;
  let orgAdminInviteId = null;

  pass("Revised scope / assignment verification starting (" + BASE + ")");

  const platformUserId = await findPlatformAdminUserId(admin);
  if (!platformUserId) {
    failures += fail("Load platform admin user");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const platformToken = await getAccessToken(admin, platformUserId);
  const authHeaders = {
    Authorization: `Bearer ${platformToken}`,
    "Content-Type": "application/json",
  };

  try {
    const createOrgRes = await fetch(`${BASE}/api/admin/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: TEST_ORG_NAME, slug: TEST_ORG_SLUG }),
    });
    if (createOrgRes.status !== 201) {
      failures += fail("Create scope-home test organization", `got ${createOrgRes.status}`);
      throw new Error("abort");
    }
    orgId = (await createOrgRes.json()).id;
    cleanup.push(async () => {
      if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    });

    for (let i = 1; i <= 5; i += 1) {
      propertyIds.push(await createProperty(authHeaders, orgId, `Hotel ${i}`));
    }
    cleanup.unshift(async () => {
      for (const id of propertyIds) {
        if (id) await admin.from("properties").delete().eq("id", id);
      }
    });

    const primaryInvitation = await inviteAdmin(authHeaders, orgId, {
      propertyId: propertyIds[0],
      email: PRIMARY_EMAIL,
      firstName: "Primary",
      lastName: "Owner",
    });
    primaryInviteId = primaryInvitation.id;
    primaryUserId = await completeInvite(
      admin,
      primaryInviteId,
      "ScopeHomePrimaryPassword123!"
    );

    const orgAdminInvitation = await inviteAdmin(authHeaders, orgId, {
      role: "organization_admin",
      propertyIds,
      email: ORG_ADMIN_EMAIL,
      firstName: "Org",
      lastName: "Admin",
    });
    orgAdminInviteId = orgAdminInvitation.id;
    orgAdminUserId = await completeInvite(
      admin,
      orgAdminInviteId,
      "ScopeHomeOrgAdminPassword123!"
    );

    const propAdminInvitation = await inviteAdmin(authHeaders, orgId, {
      role: "property_administrator",
      propertyIds: [propertyIds[0]],
      email: PROP_ADMIN_EMAIL,
      firstName: "Prop",
      lastName: "Admin",
    });
    propAdminUserId = await completeInvite(
      admin,
      propAdminInvitation.id,
      "ScopeHomePropAdminPassword123!"
    );

    cleanup.unshift(async () => {
      await admin.from("organization_invitations").delete().eq("organization_id", orgId);
      await admin.from("team_members").delete().eq("organization_id", orgId);
      await admin.from("user_properties").delete().in("property_id", propertyIds);
      await admin.from("organization_users").delete().eq("organization_id", orgId);
      for (const userId of [primaryUserId, orgAdminUserId, propAdminUserId]) {
        if (userId) await admin.auth.admin.deleteUser(userId);
      }
    });

    const detailRes = await fetch(`${BASE}/api/admin/organizations/${orgId}`, {
      headers: authHeaders,
    });
    const detail = await detailRes.json();
    const primaryCard = (detail.invitations ?? []).find((row) => row.id === primaryInviteId);
    const orgAdminCard = (detail.invitations ?? []).find((row) => row.id === orgAdminInviteId);

    failures +=
      primaryCard?.roleLabel === "Primary Owner" &&
      primaryCard?.scopeLabel === "Entire organization"
        ? pass("Primary Owner card shows Entire organization scope")
        : fail("Primary Owner card shows Entire organization scope");

    failures +=
      orgAdminCard?.orgRole === "org_admin" &&
      orgAdminCard?.scopeLabel === "5 selected properties" &&
      Array.isArray(orgAdminCard?.assignedPropertyIds) &&
      orgAdminCard.assignedPropertyIds.length === 5
        ? pass("Organization Admin card shows 5 selected properties")
        : fail(
            "Organization Admin card shows 5 selected properties",
            JSON.stringify({
              scopeLabel: orgAdminCard?.scopeLabel,
              assigned: orgAdminCard?.assignedPropertyIds,
            })
          );

    const { count: orgAdminRows } = await admin
      .from("user_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", orgAdminUserId)
      .eq("active", true);
    failures +=
      orgAdminRows === 5
        ? pass("Organization Admin has five active user_properties rows")
        : fail("Organization Admin has five active user_properties rows", `count=${orgAdminRows}`);

    const orgAdminToken = await getAccessToken(admin, orgAdminUserId);
    let orgAdminOk = 0;
    for (const id of propertyIds) {
      const dash = await fetch(`${BASE}/api/dashboard`, {
        headers: {
          Authorization: `Bearer ${orgAdminToken}`,
          "x-one-eyrie-property-id": String(id),
        },
      });
      if (dash.status === 200) orgAdminOk += 1;
    }
    failures +=
      orgAdminOk === 5
        ? pass("Organization Admin assigned to 5 properties can access only those 5")
        : fail(
            "Organization Admin assigned to 5 properties can access only those 5",
            `ok=${orgAdminOk}`
          );

    const propertySix = await createProperty(authHeaders, orgId, "Hotel 6 Unassigned");
    propertyIds.push(propertySix);
    const dashUnassigned = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
        "x-one-eyrie-property-id": String(propertySix),
      },
    });
    failures +=
      dashUnassigned.status === 403
        ? pass("Organization Admin receives 403 for an unassigned property")
        : fail(
            "Organization Admin receives 403 for an unassigned property",
            `got ${dashUnassigned.status}`
          );
    failures +=
      dashUnassigned.status === 403
        ? pass("Newly created properties are not automatically assigned to Organization Admin")
        : fail(
            "Newly created properties are not automatically assigned to Organization Admin"
          );

    const addSixth = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${orgAdminInviteId}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          firstName: "Org",
          lastName: "Admin",
          jobTitle: "Administrator",
          role: "organization_admin",
          propertyIds: propertyIds.slice(0, 6),
          modulePermissions: allModules(true),
          confirmAccessReduction: false,
        }),
      }
    );
    failures +=
      addSixth.status === 200
        ? pass("Adding a sixth property grants access")
        : fail("Adding a sixth property grants access", `got ${addSixth.status}`);

    const dashSixth = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
        "x-one-eyrie-property-id": String(propertySix),
      },
    });
    failures +=
      dashSixth.status === 200
        ? pass("Sixth property access works after assignment")
        : fail("Sixth property access works after assignment", `got ${dashSixth.status}`);

    const removeSixth = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${orgAdminInviteId}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          firstName: "Org",
          lastName: "Admin",
          jobTitle: "Administrator",
          role: "organization_admin",
          propertyIds: propertyIds.slice(0, 5),
          modulePermissions: allModules(true),
          confirmAccessReduction: true,
        }),
      }
    );
    failures +=
      removeSixth.status === 200
        ? pass("Removing one property assignment succeeds with confirmation")
        : fail(
            "Removing one property assignment succeeds with confirmation",
            `got ${removeSixth.status}`
          );

    const dashSixthRemoved = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
        "x-one-eyrie-property-id": String(propertySix),
      },
    });
    failures +=
      dashSixthRemoved.status === 403
        ? pass("Removing one property revokes access")
        : fail("Removing one property revokes access", `got ${dashSixthRemoved.status}`);

    const primaryToken = await getAccessToken(admin, primaryUserId);
    let primaryOk = 0;
    for (const id of propertyIds) {
      const dash = await fetch(`${BASE}/api/dashboard`, {
        headers: {
          Authorization: `Bearer ${primaryToken}`,
          "x-one-eyrie-property-id": String(id),
        },
      });
      if (dash.status === 200) primaryOk += 1;
    }
    failures +=
      primaryOk === propertyIds.length
        ? pass("Primary Owner can access all properties")
        : fail("Primary Owner can access all properties", `ok=${primaryOk}`);

    const propertySeven = await createProperty(authHeaders, orgId, "Hotel 7 Future");
    propertyIds.push(propertySeven);
    const primaryFuture = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${primaryToken}`,
        "x-one-eyrie-property-id": String(propertySeven),
      },
    });
    failures +=
      primaryFuture.status === 200
        ? pass("Primary Owner continues to access newly created properties automatically")
        : fail(
            "Primary Owner continues to access newly created properties automatically",
            `got ${primaryFuture.status}`
          );

    const propToken = await getAccessToken(admin, propAdminUserId);
    const propDash0 = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${propToken}`,
        "x-one-eyrie-property-id": String(propertyIds[0]),
      },
    });
    const propDash1 = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${propToken}`,
        "x-one-eyrie-property-id": String(propertyIds[1]),
      },
    });
    failures +=
      propDash0.status === 200 && propDash1.status === 403
        ? pass("Property Administrator can access exactly one property")
        : fail(
            "Property Administrator can access exactly one property",
            `0=${propDash0.status} 1=${propDash1.status}`
          );
  } catch (error) {
    if (!(error instanceof Error && error.message === "abort")) {
      failures += fail(
        "Revised scope verification",
        error instanceof Error ? error.message : "unknown error"
      );
    }
  }

  console.log(`\nFailures: ${failures}`);
  for (const undo of cleanup) {
    try {
      await undo();
    } catch {
      // Best-effort cleanup.
    }
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

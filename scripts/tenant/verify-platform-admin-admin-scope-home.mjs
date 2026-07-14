/**
 * Platform admin — Role / Scope / Home property access verification.
 *
 * Confirms organization-wide access comes from org membership (including future
 * properties), home property only controls default landing, and property
 * administrators are blocked from unassigned properties.
 *
 * Requires: npm run dev (or SMOKE_BASE_URL) and SUPPRESS_AUTH_EMAILS=true.
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
  let propertyA = null;
  let propertyB = null;
  let propertyC = null;
  let primaryUserId = null;
  let orgAdminUserId = null;
  let propAdminUserId = null;
  let primaryInviteId = null;
  let orgAdminInviteId = null;

  pass("Scope / home property verification starting (" + BASE + ")");

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

    propertyA = await createProperty(authHeaders, orgId, "Home Property A");
    propertyB = await createProperty(authHeaders, orgId, "Second Property B");
    cleanup.unshift(async () => {
      for (const id of [propertyA, propertyB, propertyC]) {
        if (id) await admin.from("properties").delete().eq("id", id);
      }
    });

    const primaryInvitation = await inviteAdmin(authHeaders, orgId, {
      propertyId: propertyA,
      email: PRIMARY_EMAIL,
      firstName: "Primary",
      lastName: "Owner",
      jobTitle: "General Manager",
    });
    primaryInviteId = primaryInvitation.id;
    primaryUserId = await completeInvite(
      admin,
      primaryInviteId,
      "ScopeHomePrimaryPassword123!"
    );

    const orgAdminInvitation = await inviteAdmin(authHeaders, orgId, {
      propertyId: propertyA,
      role: "organization_admin",
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
      propertyId: propertyA,
      role: "property_administrator",
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
      await admin
        .from("user_properties")
        .delete()
        .in("property_id", [propertyA, propertyB, propertyC].filter(Boolean));
      await admin.from("organization_users").delete().eq("organization_id", orgId);
      for (const userId of [primaryUserId, orgAdminUserId, propAdminUserId]) {
        if (userId) await admin.auth.admin.deleteUser(userId);
      }
    });

    // Card / API labels
    const detailRes = await fetch(`${BASE}/api/admin/organizations/${orgId}`, {
      headers: authHeaders,
    });
    const detail = await detailRes.json();
    const primaryCard = (detail.invitations ?? []).find((row) => row.id === primaryInviteId);
    const orgAdminCard = (detail.invitations ?? []).find((row) => row.id === orgAdminInviteId);

    failures +=
      primaryCard?.roleLabel === "Primary Owner" &&
      primaryCard?.scopeLabel === "Entire organization" &&
      primaryCard?.propertyName === "Home Property A"
        ? pass("Primary Owner card shows Entire organization + home property name")
        : fail(
            "Primary Owner card shows Entire organization + home property name",
            JSON.stringify({
              roleLabel: primaryCard?.roleLabel,
              scopeLabel: primaryCard?.scopeLabel,
              propertyName: primaryCard?.propertyName,
            })
          );

    failures +=
      orgAdminCard?.roleLabel === "Organization Admin" &&
      orgAdminCard?.scopeLabel === "Entire organization"
        ? pass("Organization Admin card shows Entire organization scope")
        : fail("Organization Admin card shows Entire organization scope");

    // Org admin: access both existing properties without duplicated membership rows
    const { count: orgAdminPropertyRows } = await admin
      .from("user_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", orgAdminUserId)
      .eq("active", true);
    failures +=
      orgAdminPropertyRows === 1
        ? pass("Organization Admin keeps a single home user_properties row")
        : fail(
            "Organization Admin keeps a single home user_properties row",
            `count=${orgAdminPropertyRows}`
          );

    const orgAdminToken = await getAccessToken(admin, orgAdminUserId);
    const dashA = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
        "x-one-eyrie-property-id": String(propertyA),
      },
    });
    const dashB = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
        "x-one-eyrie-property-id": String(propertyB),
      },
    });
    failures +=
      dashA.status === 200 && dashB.status === 200
        ? pass("Organization Admin can access two existing properties")
        : fail(
            "Organization Admin can access two existing properties",
            `A=${dashA.status} B=${dashB.status}`
          );

    // Home property controls default landing only
    const ctxDefault = await fetch(`${BASE}/api/tenant/context`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    if (ctxDefault.status === 200) {
      const body = await ctxDefault.json();
      failures +=
        body.activeProperty?.id === propertyA
          ? pass("Organization Admin home property controls initial landing")
          : fail(
              "Organization Admin home property controls initial landing",
              `active=${body.activeProperty?.id}`
            );
    } else {
      failures += fail(
        "Organization Admin home property controls initial landing",
        `got ${ctxDefault.status}`
      );
    }

    // Change home property A -> B; still org-wide; landing becomes B
    const homeChange = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${orgAdminInviteId}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          firstName: "Org",
          lastName: "Admin",
          jobTitle: "Administrator",
          role: "organization_admin",
          propertyIds: [propertyB],
          modulePermissions: {
            dashboard: true,
            reports: true,
            lost_found: true,
            pass_on: true,
            inspections: true,
            maintenance: true,
            settings: true,
          },
          confirmAccessReduction: false,
        }),
      }
    );
    if (homeChange.status !== 200) {
      const body = await homeChange.text();
      failures += fail(
        "Organization Admin home property can change without scope reduction",
        `got ${homeChange.status}: ${body}`
      );
    } else {
      failures += pass(
        "Organization Admin home property can change without scope reduction"
      );
    }

    const dashAAfterHome = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
        "x-one-eyrie-property-id": String(propertyA),
      },
    });
    failures +=
      dashAAfterHome.status === 200
        ? pass("Changing home property does not remove organization-wide access")
        : fail(
            "Changing home property does not remove organization-wide access",
            `got ${dashAAfterHome.status}`
          );

    const ctxAfterHome = await fetch(`${BASE}/api/tenant/context`, {
      headers: { Authorization: `Bearer ${orgAdminToken}` },
    });
    if (ctxAfterHome.status === 200) {
      const body = await ctxAfterHome.json();
      failures +=
        body.activeProperty?.id === propertyB
          ? pass("Updated home property becomes the default landing property")
          : fail(
              "Updated home property becomes the default landing property",
              `active=${body.activeProperty?.id}`
            );
    } else {
      failures += fail(
        "Updated home property becomes the default landing property",
        `got ${ctxAfterHome.status}`
      );
    }

    // Future property automatically accessible to org admin (no new membership required)
    propertyC = await createProperty(authHeaders, orgId, "Future Property C");
    const { count: orgAdminRowsAfterC } = await admin
      .from("user_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", orgAdminUserId)
      .eq("active", true);
    failures +=
      orgAdminRowsAfterC === 1
        ? pass("New property does not duplicate Organization Admin user_properties rows")
        : fail(
            "New property does not duplicate Organization Admin user_properties rows",
            `count=${orgAdminRowsAfterC}`
          );

    const dashC = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
        "x-one-eyrie-property-id": String(propertyC),
      },
    });
    failures +=
      dashC.status === 200
        ? pass("Organization Admin automatically accesses a newly created property")
        : fail(
            "Organization Admin automatically accesses a newly created property",
            `got ${dashC.status}`
          );

    // Primary Owner remains org-wide regardless of home (still A)
    const primaryToken = await getAccessToken(admin, primaryUserId);
    const primaryDashC = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${primaryToken}`,
        "x-one-eyrie-property-id": String(propertyC),
      },
    });
    failures +=
      primaryDashC.status === 200
        ? pass("Primary Owner remains organization-wide regardless of home property")
        : fail(
            "Primary Owner remains organization-wide regardless of home property",
            `got ${primaryDashC.status}`
          );

    // Property Administrator: A OK, B and C 403
    const propToken = await getAccessToken(admin, propAdminUserId);
    const propDashA = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${propToken}`,
        "x-one-eyrie-property-id": String(propertyA),
      },
    });
    const propDashB = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${propToken}`,
        "x-one-eyrie-property-id": String(propertyB),
      },
    });
    const propDashC = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${propToken}`,
        "x-one-eyrie-property-id": String(propertyC),
      },
    });
    failures +=
      propDashA.status === 200
        ? pass("Property Administrator can access assigned property")
        : fail("Property Administrator can access assigned property", `got ${propDashA.status}`);
    failures +=
      propDashB.status === 403 && propDashC.status === 403
        ? pass("Property Administrator receives 403 for every unassigned property")
        : fail(
            "Property Administrator receives 403 for every unassigned property",
            `B=${propDashB.status} C=${propDashC.status}`
          );
  } catch (error) {
    if (!(error instanceof Error && error.message === "abort")) {
      failures += fail(
        "Scope / home property verification",
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

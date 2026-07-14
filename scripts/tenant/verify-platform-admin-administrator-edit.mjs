/**
 * Platform admin portal — Administrator edit verification.
 *
 * Covers accepted-admin PATCH updates: profile, role/scope, multi-property
 * assignments, module permissions, Primary Owner protections, and hotel-side
 * property access after scope changes.
 *
 * Requires: npm run dev (or SMOKE_BASE_URL) and SUPPRESS_AUTH_EMAILS=true.
 *
 * Usage: node scripts/tenant/verify-platform-admin-administrator-edit.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import { assertAuthEmailsSuppressed, testEmail } from "./auth-email-guard.mjs";
import {
  fail,
  getAccessToken,
  pass,
} from "./tenant-verify-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const STAMP = Date.now();
const TEST_ORG_SLUG = `admin-edit-verify-${STAMP}`;
const TEST_ORG_NAME = `Admin Edit Verify ${STAMP}`;
const PRIMARY_EMAIL = testEmail(`edit.primary.${STAMP}`);
const ADMIN_EMAIL = testEmail(`edit.admin.${STAMP}`);

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
  if (!userId) {
    throw new Error("Invitation missing auth_user_id");
  }

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
  let propertyA = null;
  let propertyB = null;
  let primaryInviteId = null;
  let adminInviteId = null;
  let primaryUserId = null;
  let adminUserId = null;

  pass("Administrator edit verification starting (" + BASE + ")");

  try {
    const unauth = await fetch(
      `${BASE}/api/admin/organizations/1/invitations/00000000-0000-0000-0000-000000000001`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    failures +=
      unauth.status === 401
        ? pass("PATCH administrator without auth returns 401")
        : fail("PATCH administrator without auth returns 401", `got ${unauth.status}`);
  } catch (error) {
    failures += fail(
      "PATCH administrator endpoint reachable",
      error instanceof Error ? error.message : "fetch failed"
    );
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

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
      failures += fail("Create edit-test organization", `got ${createOrgRes.status}`);
      throw new Error("abort");
    }

    const organization = await createOrgRes.json();
    orgId = organization.id;
    cleanup.push(async () => {
      if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    });

    const createProperty = async (name) => {
      const res = await fetch(`${BASE}/api/admin/organizations/${orgId}/properties`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name,
          address: "1 Edit Lane",
          timezone: "America/New_York",
        }),
      });
      if (res.status !== 201) {
        throw new Error(`create property failed (${res.status})`);
      }
      return (await res.json()).id;
    };

    propertyA = await createProperty("Edit Property A");
    propertyB = await createProperty("Edit Property B");
    cleanup.unshift(async () => {
      if (propertyA) await admin.from("properties").delete().eq("id", propertyA);
      if (propertyB) await admin.from("properties").delete().eq("id", propertyB);
    });

    // Enable all modules so permission edits are meaningful.
    await fetch(`${BASE}/api/admin/organizations/${orgId}/modules`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        modules: [
          "dashboard",
          "reports",
          "lost_found",
          "pass_on",
          "inspections",
          "maintenance",
          "settings",
        ].map((moduleKey) => ({ moduleKey, enabled: true })),
      }),
    });

    const primaryInviteRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          propertyId: propertyA,
          email: PRIMARY_EMAIL,
          firstName: "Primary",
          lastName: "Owner",
          jobTitle: "General Manager",
        }),
      }
    );
    if (primaryInviteRes.status !== 201) {
      failures += fail("Invite Primary Owner", `got ${primaryInviteRes.status}`);
      throw new Error("abort");
    }
    const primaryInvitation = await primaryInviteRes.json();
    primaryInviteId = primaryInvitation.id;

    primaryUserId = await completeInvite(
      admin,
      primaryInviteId,
      "AdminEditPrimaryPassword123!"
    );
    cleanup.unshift(async () => {
      if (primaryUserId) await admin.auth.admin.deleteUser(primaryUserId);
    });

    const adminInviteRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          propertyId: propertyA,
          role: "property_administrator",
          email: ADMIN_EMAIL,
          firstName: "Scoped",
          lastName: "Admin",
          jobTitle: "Assistant GM",
        }),
      }
    );
    if (adminInviteRes.status !== 201) {
      failures += fail("Invite property administrator", `got ${adminInviteRes.status}`);
      throw new Error("abort");
    }
    const adminInvitation = await adminInviteRes.json();
    adminInviteId = adminInvitation.id;
    adminUserId = await completeInvite(
      admin,
      adminInviteId,
      "AdminEditSecondaryPassword123!"
    );
    cleanup.unshift(async () => {
      if (adminUserId) await admin.auth.admin.deleteUser(adminUserId);
      await admin.from("organization_invitations").delete().eq("organization_id", orgId);
      await admin
        .from("team_members")
        .delete()
        .eq("organization_id", orgId);
      await admin
        .from("user_properties")
        .delete()
        .in("property_id", [propertyA, propertyB]);
      await admin
        .from("organization_users")
        .delete()
        .eq("organization_id", orgId);
    });

    // --- Primary Owner: name/job title OK; downgrade/disable/remove blocked ---
    const primaryNamePatch = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${primaryInviteId}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          firstName: "PrimaryUpdated",
          lastName: "OwnerUpdated",
          jobTitle: "Regional Director",
          role: "organization_admin",
          propertyIds: [propertyA],
          modulePermissions: allModules(true),
          confirmAccessReduction: false,
        }),
      }
    );
    if (primaryNamePatch.status === 200) {
      const body = await primaryNamePatch.json();
      failures +=
        body.invitation?.firstName === "PrimaryUpdated" &&
        body.invitation?.jobTitle === "Regional Director"
          ? pass("Primary Owner name/job-title edits succeed")
          : fail("Primary Owner name/job-title edits succeed");
    } else {
      failures += fail(
        "Primary Owner name/job-title edits succeed",
        `got ${primaryNamePatch.status}`
      );
    }

    const primaryDowngrade = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${primaryInviteId}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          firstName: "PrimaryUpdated",
          lastName: "OwnerUpdated",
          jobTitle: "Regional Director",
          role: "property_administrator",
          propertyIds: [propertyA],
          modulePermissions: allModules(true),
          confirmAccessReduction: true,
        }),
      }
    );
    failures +=
      primaryDowngrade.status === 409
        ? pass("Primary Owner property-only scope change rejected")
        : fail(
            "Primary Owner property-only scope change rejected",
            `got ${primaryDowngrade.status}`
          );

    const primaryDisable = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${primaryInviteId}`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "disable" }),
      }
    );
    failures +=
      primaryDisable.status === 409
        ? pass("Primary Owner disable rejected")
        : fail("Primary Owner disable rejected", `got ${primaryDisable.status}`);

    const primaryRemove = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${primaryInviteId}`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "remove" }),
      }
    );
    failures +=
      primaryRemove.status === 409
        ? pass("Primary Owner remove rejected")
        : fail("Primary Owner remove rejected", `got ${primaryRemove.status}`);

    // --- Non-primary: name/job title ---
    const namePatch = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInviteId}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          firstName: "ScopedUpdated",
          lastName: "AdminUpdated",
          jobTitle: "Area Manager",
          role: "property_administrator",
          propertyIds: [propertyA],
          modulePermissions: allModules(true),
          confirmAccessReduction: false,
        }),
      }
    );
    failures +=
      namePatch.status === 200
        ? pass("Non-primary name/job-title edit succeeds")
        : fail("Non-primary name/job-title edit succeeds", `got ${namePatch.status}`);

    // Promote property admin → organization-wide (widening; no confirm needed)
    const promotePatch = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInviteId}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          firstName: "ScopedUpdated",
          lastName: "AdminUpdated",
          jobTitle: "Area Manager",
          role: "organization_admin",
          propertyIds: [propertyA],
          modulePermissions: allModules(true),
          confirmAccessReduction: false,
        }),
      }
    );
    if (promotePatch.status === 200) {
      const body = await promotePatch.json();
      failures +=
        body.invitation?.orgRole === "org_admin"
          ? pass("Property administrator promoted to organization-wide access")
          : fail("Property administrator promoted to organization-wide access");
    } else {
      failures += fail(
        "Property administrator promoted to organization-wide access",
        `got ${promotePatch.status}`
      );
    }

    // Org → selected properties without confirm should 409
    const reduceWithoutConfirm = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInviteId}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          firstName: "ScopedUpdated",
          lastName: "AdminUpdated",
          jobTitle: "Area Manager",
          role: "property_administrator",
          propertyIds: [propertyA],
          modulePermissions: allModules(true),
          confirmAccessReduction: false,
        }),
      }
    );
    failures +=
      reduceWithoutConfirm.status === 409
        ? pass("Org→property scope reduction requires confirmation")
        : fail(
            "Org→property scope reduction requires confirmation",
            `got ${reduceWithoutConfirm.status}`
          );

    const reduceWithConfirm = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInviteId}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          firstName: "ScopedUpdated",
          lastName: "AdminUpdated",
          jobTitle: "Area Manager",
          role: "property_administrator",
          propertyIds: [propertyA, propertyB],
          modulePermissions: {
            ...allModules(true),
            reports: false,
          },
          confirmAccessReduction: true,
        }),
      }
    );
    if (reduceWithConfirm.status === 200) {
      const body = await reduceWithConfirm.json();
      const ids = body.invitation?.assignedPropertyIds ?? [];
      failures +=
        body.invitation?.orgRole === "org_member" &&
        ids.includes(propertyA) &&
        ids.includes(propertyB)
          ? pass("Organization admin reduced to multi-property access")
          : fail("Organization admin reduced to multi-property access");
    } else {
      failures += fail(
        "Organization admin reduced to multi-property access",
        `got ${reduceWithConfirm.status}`
      );
    }

    const { data: upRows } = await admin
      .from("user_properties")
      .select("property_id, active, module_permissions")
      .eq("user_id", adminUserId)
      .in("property_id", [propertyA, propertyB]);

    const activeIds = (upRows ?? [])
      .filter((row) => row.active)
      .map((row) => row.property_id)
      .sort();
    failures +=
      activeIds[0] === propertyA && activeIds[1] === propertyB
        ? pass("user_properties active for both assigned properties")
        : fail(
            "user_properties active for both assigned properties",
            `ids=${JSON.stringify(activeIds)}`
          );

    const reportsOff = (upRows ?? []).every(
      (row) => row.active && row.module_permissions?.reports === false
    );
    failures += reportsOff
      ? pass("Module permissions updated (reports capped off)")
      : fail("Module permissions updated (reports capped off)");

    const { data: orgUser } = await admin
      .from("organization_users")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", adminUserId)
      .maybeSingle();
    failures +=
      orgUser?.role === "org_member"
        ? pass("organization_users role is org_member after property scope")
        : fail("organization_users role is org_member after property scope");

    const { data: auditRows } = await admin
      .from("admin_audit_log")
      .select("action, metadata")
      .eq("action", "administrator.updated")
      .eq("target_id", adminInviteId)
      .order("created_at", { ascending: false })
      .limit(1);
    failures +=
      auditRows?.[0]?.action === "administrator.updated"
        ? pass("administrator.updated audit row written")
        : fail("administrator.updated audit row written");

    // Hotel-side access: both properties OK, a third unassigned property not available
    const adminToken = await getAccessToken(admin, adminUserId);
    const dashA = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-one-eyrie-property-id": String(propertyA),
      },
    });
    failures +=
      dashA.status === 200
        ? pass("Newly assigned property access works (property A)")
        : fail("Newly assigned property access works (property A)", `got ${dashA.status}`);

    const dashB = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-one-eyrie-property-id": String(propertyB),
      },
    });
    failures +=
      dashB.status === 200
        ? pass("Newly assigned property access works (property B)")
        : fail("Newly assigned property access works (property B)", `got ${dashB.status}`);

    // Remove property B and confirm 403
    const removeB = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInviteId}`,
      {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          firstName: "ScopedUpdated",
          lastName: "AdminUpdated",
          jobTitle: "Area Manager",
          role: "property_administrator",
          propertyIds: [propertyA],
          modulePermissions: {
            ...allModules(true),
            reports: false,
          },
          confirmAccessReduction: true,
        }),
      }
    );
    failures +=
      removeB.status === 200
        ? pass("Removed property B from assignments")
        : fail("Removed property B from assignments", `got ${removeB.status}`);

    const dashBBlocked = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-one-eyrie-property-id": String(propertyB),
      },
    });
    failures +=
      dashBBlocked.status === 403
        ? pass("Removed property access returns 403")
        : fail("Removed property access returns 403", `got ${dashBBlocked.status}`);

    // Email must not change
    const { data: authUser } = await admin.auth.admin.getUserById(adminUserId);
    failures +=
      authUser?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
        ? pass("Supabase Auth email remains unchanged")
        : fail("Supabase Auth email remains unchanged");
  } catch (error) {
    if (error instanceof Error && error.message !== "abort") {
      failures += fail(
        "Administrator edit verification",
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

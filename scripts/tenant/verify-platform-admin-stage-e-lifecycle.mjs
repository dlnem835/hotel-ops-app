/**
 * Platform admin portal — pre-Stage F organization lifecycle verification.
 *
 * Requires dev server: npm run dev (or SMOKE_BASE_URL).
 *
 * Usage: node scripts/tenant/verify-platform-admin-stage-e-lifecycle.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  fail,
  findTeamManagerAuthUserId,
  getAccessToken,
  pass,
} from "./tenant-verify-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const TEST_ORG_SLUG = `stage-e-lifecycle-${Date.now()}`;
const TEST_ORG_NAME = `Stage E Lifecycle ${Date.now()}`;

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

async function expectStatus(response, status, label, failures) {
  if (response.status === status) {
    pass(label);
    return failures;
  }
  return failures + fail(label, `got ${response.status}`);
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey);
  let failures = 0;
  const cleanup = [];

  pass("Lifecycle verification starting (requires dev server at " + BASE + ")");

  const lifecycleRoutes = [
    { method: "POST", path: "/api/admin/organizations/1/suspend" },
    { method: "POST", path: "/api/admin/organizations/1/reactivate" },
    { method: "DELETE", path: "/api/admin/organizations/999999" },
  ];

  for (const route of lifecycleRoutes) {
    try {
      const response = await fetch(`${BASE}${route.path}`, {
        method: route.method,
        headers: { "Content-Type": "application/json" },
        body: route.method === "DELETE" ? JSON.stringify({ confirmName: "x" }) : undefined,
      });
      failures = await expectStatus(
        response,
        401,
        `${route.method} ${route.path} without auth returns 401`,
        failures
      );
    } catch (error) {
      failures += fail(
        `${route.method} ${route.path} reachable`,
        error instanceof Error ? error.message : "fetch failed — is npm run dev running?"
      );
      console.log(`\nFailures: ${failures}`);
      process.exit(1);
    }
  }

  const managerUserId = await findTeamManagerAuthUserId(admin, 1, 1);
  if (!managerUserId) {
    failures += fail("Load pilot hotel user for 403 checks");
  } else {
    const hotelToken = await getAccessToken(admin, managerUserId);
    for (const route of lifecycleRoutes) {
      const response = await fetch(`${BASE}${route.path}`, {
        method: route.method,
        headers: {
          Authorization: `Bearer ${hotelToken}`,
          "Content-Type": "application/json",
        },
        body: route.method === "DELETE" ? JSON.stringify({ confirmName: "x" }) : undefined,
      });
      failures = await expectStatus(
        response,
        403,
        `${route.method} ${route.path} with hotel user returns 403`,
        failures
      );
    }
  }

  const platformUserId = await findPlatformAdminUserId(admin);
  if (!platformUserId) {
    failures += fail("Load platform admin user");
  } else {
    const platformToken = await getAccessToken(admin, platformUserId);
    const authHeaders = {
      Authorization: `Bearer ${platformToken}`,
      "Content-Type": "application/json",
    };

    const suspendPilotRes = await fetch(`${BASE}/api/admin/organizations/1/suspend`, {
      method: "POST",
      headers: authHeaders,
    });
    failures =
      suspendPilotRes.status === 409
        ? pass("POST /api/admin/organizations/1/suspend returns 409 for pilot")
        : failures +
          fail("POST /api/admin/organizations/1/suspend returns 409 for pilot", `got ${suspendPilotRes.status}`);

    const createOrgRes = await fetch(`${BASE}/api/admin/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: TEST_ORG_NAME, slug: TEST_ORG_SLUG }),
    });

    if (createOrgRes.status !== 201) {
      failures += fail("Create lifecycle test organization", `got ${createOrgRes.status}`);
    } else {
      const organization = await createOrgRes.json();
      const orgId = organization.id;
      cleanup.push(() => admin.from("organizations").delete().eq("id", orgId));

      failures +=
        organization.lifecycle?.canSuspend === true
          ? pass("Lifecycle test org canSuspend=true")
          : fail("Lifecycle test org canSuspend=true");

      failures +=
        organization.lifecycle?.canDeleteTestOrganization === true
          ? pass("Lifecycle test org canDeleteTestOrganization=true")
          : fail("Lifecycle test org canDeleteTestOrganization=true");

      const suspendRes = await fetch(`${BASE}/api/admin/organizations/${orgId}/suspend`, {
        method: "POST",
        headers: authHeaders,
      });
      if (suspendRes.status !== 200) {
        failures += fail("Suspend lifecycle test organization", `got ${suspendRes.status}`);
      } else {
        const suspended = await suspendRes.json();
        failures +=
          suspended.status === "suspended" && suspended.lifecycle?.canReactivate === true
            ? pass("Suspended organization status and lifecycle flags updated")
            : fail("Suspended organization status and lifecycle flags updated");
      }

      const { data: suspendAuditRows } = await admin
        .from("admin_audit_log")
        .select("action, target_id, organization_id")
        .eq("action", "organization.suspended")
        .eq("target_id", String(orgId))
        .order("created_at", { ascending: false })
        .limit(1);
      failures +=
        suspendAuditRows?.[0]?.organization_id === orgId
          ? pass("organization.suspended audit row written")
          : fail("organization.suspended audit row written");

      const reactivateRes = await fetch(`${BASE}/api/admin/organizations/${orgId}/reactivate`, {
        method: "POST",
        headers: authHeaders,
      });
      if (reactivateRes.status !== 200) {
        failures += fail("Reactivate lifecycle test organization", `got ${reactivateRes.status}`);
      } else {
        const reactivated = await reactivateRes.json();
        failures +=
          reactivated.status === "active" && reactivated.lifecycle?.canSuspend === true
            ? pass("Reactivated organization status and lifecycle flags updated")
            : fail("Reactivated organization status and lifecycle flags updated");
      }

      const { data: reactivateAuditRows } = await admin
        .from("admin_audit_log")
        .select("action, target_id, organization_id")
        .eq("action", "organization.reactivated")
        .eq("target_id", String(orgId))
        .order("created_at", { ascending: false })
        .limit(1);
      failures +=
        reactivateAuditRows?.[0]?.organization_id === orgId
          ? pass("organization.reactivated audit row written")
          : fail("organization.reactivated audit row written");

      const wrongNameDeleteRes = await fetch(`${BASE}/api/admin/organizations/${orgId}`, {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({ confirmName: "wrong-name" }),
      });
      failures =
        wrongNameDeleteRes.status === 400
          ? pass("DELETE with wrong confirmName returns 400")
          : failures +
            fail("DELETE with wrong confirmName returns 400", `got ${wrongNameDeleteRes.status}`);

      const createPropertyRes = await fetch(`${BASE}/api/admin/organizations/${orgId}/properties`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          name: "Lifecycle Blocker Property",
          address: "1 Blocker Way",
          timezone: "America/New_York",
        }),
      });

      if (createPropertyRes.status !== 201) {
        failures += fail("Create property to block deletion", `got ${createPropertyRes.status}`);
      } else {
        const property = await createPropertyRes.json();

        const blockedDeleteRes = await fetch(`${BASE}/api/admin/organizations/${orgId}`, {
          method: "DELETE",
          headers: authHeaders,
          body: JSON.stringify({ confirmName: TEST_ORG_NAME }),
        });
        failures =
          blockedDeleteRes.status === 409
            ? pass("DELETE blocked when organization has a property")
            : failures +
              fail("DELETE blocked when organization has a property", `got ${blockedDeleteRes.status}`);

        const { error: removePropertyError } = await admin
          .from("properties")
          .delete()
          .eq("id", property.id);
        failures +=
          removePropertyError == null
            ? pass("Removed blocker property before delete test")
            : fail("Remove blocker property before delete test", removePropertyError.message);
      }

      const deleteRes = await fetch(`${BASE}/api/admin/organizations/${orgId}`, {
        method: "DELETE",
        headers: authHeaders,
        body: JSON.stringify({ confirmName: TEST_ORG_NAME }),
      });
      if (deleteRes.status !== 204) {
        failures += fail("DELETE empty test organization returns 204", `got ${deleteRes.status}`);
      } else {
        pass("DELETE empty test organization returns 204");
        const removeCleanup = cleanup.pop();
        if (removeCleanup) {
          // Org already deleted; skip org cleanup.
        }

        const { data: deletedOrg } = await admin
          .from("organizations")
          .select("id")
          .eq("id", orgId)
          .maybeSingle();
        failures += deletedOrg ? fail("Deleted organization removed from database") : pass("Deleted organization removed from database");

        const { data: deleteAuditRows } = await admin
          .from("admin_audit_log")
          .select("action, target_id, metadata")
          .eq("action", "organization.deleted")
          .eq("target_id", String(orgId))
          .order("created_at", { ascending: false })
          .limit(1);
        failures +=
          deleteAuditRows?.[0]?.metadata?.reason === "test_organization_cleanup"
            ? pass("organization.deleted audit row written")
            : fail("organization.deleted audit row written");
      }
    }
  }

  console.log(`\nFailures: ${failures}`);
  for (const undo of cleanup.reverse()) {
    await undo();
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

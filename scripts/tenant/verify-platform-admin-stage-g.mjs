/**
 * Platform admin portal — Stage G verification.
 *
 * Verifies organization module controls API, audit logging, and permission capping.
 * Requires dev server: npm run dev (or SMOKE_BASE_URL).
 *
 * Usage: node scripts/tenant/verify-platform-admin-stage-g.mjs
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
const TEST_ORG_SLUG = `stage-g-verify-${Date.now()}`;
const TEST_ORG_NAME = `Stage G Verify ${Date.now()}`;

const MODULE_KEYS = [
  "dashboard",
  "reports",
  "lost_found",
  "pass_on",
  "inspections",
  "maintenance",
  "settings",
];

function buildModulesPayload(enabledByKey) {
  return {
    modules: MODULE_KEYS.map((moduleKey) => ({
      moduleKey,
      enabled: enabledByKey[moduleKey] ?? true,
    })),
  };
}

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
  let orgId = null;
  let propertyId = null;
  let membershipId = null;

  pass("Stage G verification starting (requires dev server at " + BASE + ")");

  const modulesEndpoint = "/api/admin/organizations/1/modules";

  try {
    const unauthGet = await fetch(`${BASE}${modulesEndpoint}`);
    failures = await expectStatus(
      unauthGet,
      401,
      "GET /api/admin/organizations/1/modules without auth returns 401",
      failures
    );

    const unauthPatch = await fetch(`${BASE}${modulesEndpoint}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildModulesPayload({})),
    });
    failures = await expectStatus(
      unauthPatch,
      401,
      "PATCH /api/admin/organizations/1/modules without auth returns 401",
      failures
    );
  } catch (error) {
    failures += fail(
      "Modules endpoint reachable",
      error instanceof Error ? error.message : "fetch failed"
    );
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const managerUserId = await findTeamManagerAuthUserId(admin, 1, 1);
  if (!managerUserId) {
    failures += fail("Load pilot hotel user for 403 checks");
  } else {
    const hotelToken = await getAccessToken(admin, managerUserId);
    const hotelHeaders = {
      Authorization: `Bearer ${hotelToken}`,
      "Content-Type": "application/json",
    };

    const hotelGet = await fetch(`${BASE}${modulesEndpoint}`, { headers: hotelHeaders });
    failures = await expectStatus(
      hotelGet,
      403,
      "GET modules with hotel user returns 403",
      failures
    );

    const hotelPatch = await fetch(`${BASE}${modulesEndpoint}`, {
      method: "PATCH",
      headers: hotelHeaders,
      body: JSON.stringify(buildModulesPayload({})),
    });
    failures = await expectStatus(
      hotelPatch,
      403,
      "PATCH modules with hotel user returns 403",
      failures
    );
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

    const createOrgRes = await fetch(`${BASE}/api/admin/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: TEST_ORG_NAME, slug: TEST_ORG_SLUG }),
    });
    if (createOrgRes.status !== 201) {
      failures += fail("Create Stage G test organization", `got ${createOrgRes.status}`);
    } else {
      const organization = await createOrgRes.json();
      orgId = organization.id;
      cleanup.push(async () => {
        if (orgId) await admin.from("organizations").delete().eq("id", orgId);
      });

      const createPropertyRes = await fetch(
        `${BASE}/api/admin/organizations/${orgId}/properties`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            name: "Stage G Test Property",
            address: "200 Module Lane",
          }),
        }
      );
      if (createPropertyRes.status !== 201) {
        failures += fail("Create Stage G test property", `got ${createPropertyRes.status}`);
      } else {
        const property = await createPropertyRes.json();
        propertyId = property.id;
        cleanup.unshift(async () => {
          if (propertyId) await admin.from("properties").delete().eq("id", propertyId);
        });

        const getModulesRes = await fetch(`${BASE}/api/admin/organizations/${orgId}/modules`, {
          headers: authHeaders,
        });
        if (getModulesRes.status !== 200) {
          failures += fail("GET modules for test organization", `got ${getModulesRes.status}`);
        } else {
          const body = await getModulesRes.json();
          const enabledCount = (body.modules ?? []).filter((row) => row.enabled).length;
          failures +=
            enabledCount === MODULE_KEYS.length
              ? pass("GET modules returns all modules enabled for new org")
              : fail("GET modules returns all modules enabled for new org", `enabled=${enabledCount}`);
        }

        const invalidPatch = await fetch(`${BASE}/api/admin/organizations/${orgId}/modules`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            modules: [{ moduleKey: "not_a_module", enabled: true }],
          }),
        });
        failures = await expectStatus(
          invalidPatch,
          400,
          "PATCH with invalid module key returns 400",
          failures
        );

        const partialPatch = await fetch(`${BASE}/api/admin/organizations/${orgId}/modules`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            modules: [{ moduleKey: "dashboard", enabled: true }],
          }),
        });
        failures = await expectStatus(
          partialPatch,
          400,
          "PATCH with partial module list returns 400",
          failures
        );

        const { data: membership, error: membershipError } = await admin
          .from("user_properties")
          .insert({
            property_id: propertyId,
            user_id: platformUserId,
            role: "property_admin",
            module_permissions: {
              dashboard: true,
              reports: true,
              lost_found: true,
              pass_on: true,
              inspections: true,
              maintenance: true,
              settings: true,
            },
          })
          .select("id")
          .single();

        if (membershipError || !membership) {
          failures += fail("Seed user_properties row for permission capping test", membershipError?.message);
        } else {
          membershipId = membership.id;
          cleanup.unshift(async () => {
            if (membershipId) {
              await admin.from("user_properties").delete().eq("id", membershipId);
            }
          });

          const disableReportsPayload = buildModulesPayload({ reports: false });
          const patchRes = await fetch(`${BASE}/api/admin/organizations/${orgId}/modules`, {
            method: "PATCH",
            headers: authHeaders,
            body: JSON.stringify(disableReportsPayload),
          });
          if (patchRes.status !== 200) {
            const body = await patchRes.text();
            failures += fail("PATCH disable reports returns 200", `got ${patchRes.status}: ${body}`);
          } else {
            const patchBody = await patchRes.json();
            const reportsRow = (patchBody.modules ?? []).find((row) => row.moduleKey === "reports");
            failures +=
              reportsRow?.enabled === false
                ? pass("PATCH response shows reports disabled")
                : fail("PATCH response shows reports disabled");

            const { data: orgModuleRow } = await admin
              .from("organization_modules")
              .select("enabled")
              .eq("organization_id", orgId)
              .eq("module_key", "reports")
              .maybeSingle();
            failures +=
              orgModuleRow?.enabled === false
                ? pass("organization_modules.reports disabled in database")
                : fail("organization_modules.reports disabled in database");

            const { data: auditRows } = await admin
              .from("admin_audit_log")
              .select("action, metadata")
              .eq("action", "modules.updated")
              .eq("organization_id", orgId)
              .order("created_at", { ascending: false })
              .limit(1);
            failures +=
              auditRows?.[0]?.action === "modules.updated"
                ? pass("modules.updated audit row written")
                : fail("modules.updated audit row written");

            const { data: cappedMembership } = await admin
              .from("user_properties")
              .select("module_permissions")
              .eq("id", membershipId)
              .maybeSingle();
            failures +=
              cappedMembership?.module_permissions?.reports === false
                ? pass("user_properties.module_permissions capped when reports disabled")
                : fail("user_properties.module_permissions capped when reports disabled");
          }
        }
      }
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

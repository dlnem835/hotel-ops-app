/**
 * Platform admin portal — Stage E verification.
 *
 * Verifies organization/property creation APIs and audit logging.
 * Requires dev server: npm run dev (or SMOKE_BASE_URL).
 *
 * Usage: node scripts/tenant/verify-platform-admin-stage-e.mjs
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
const TEST_ORG_SLUG = `stage-e-verify-${Date.now()}`;
const TEST_ORG_NAME = `Stage E Verify ${Date.now()}`;

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

  pass("Stage E verification starting (requires dev server at " + BASE + ")");

  const postEndpoints = [
    "/api/admin/organizations",
    "/api/admin/organizations/1/properties",
  ];

  for (const endpoint of postEndpoints) {
    try {
      const response = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      failures = await expectStatus(
        response,
        401,
        `POST ${endpoint} without auth returns 401`,
        failures
      );
    } catch (error) {
      failures += fail(
        `POST ${endpoint} reachable`,
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
    for (const endpoint of postEndpoints) {
      const response = await fetch(`${BASE}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hotelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Blocked" }),
      });
      failures = await expectStatus(
        response,
        403,
        `POST ${endpoint} with hotel user returns 403`,
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

    const invalidOrgRes = await fetch(`${BASE}/api/admin/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "" }),
    });
    failures =
      invalidOrgRes.status === 400
        ? pass("POST /api/admin/organizations with empty name returns 400")
        : failures +
          fail("POST /api/admin/organizations with empty name returns 400", `got ${invalidOrgRes.status}`);

    const { data: pilotOrg } = await admin
      .from("organizations")
      .select("slug")
      .eq("id", 1)
      .maybeSingle();

    if (!pilotOrg?.slug) {
      failures += fail("Load pilot organization slug for duplicate check");
    } else {
      const duplicateSlugRes = await fetch(`${BASE}/api/admin/organizations`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ name: "Duplicate Slug Test", slug: pilotOrg.slug }),
      });
      failures =
        duplicateSlugRes.status === 409
          ? pass("POST /api/admin/organizations with duplicate slug returns 409")
          : failures +
            fail(
              "POST /api/admin/organizations with duplicate slug returns 409",
              `got ${duplicateSlugRes.status}`
            );
    }

    const createOrgRes = await fetch(`${BASE}/api/admin/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: TEST_ORG_NAME, slug: TEST_ORG_SLUG }),
    });

    if (createOrgRes.status !== 201) {
      failures += fail("POST /api/admin/organizations creates organization", `got ${createOrgRes.status}`);
    } else {
      const organization = await createOrgRes.json();
      cleanup.push(() => admin.from("organizations").delete().eq("id", organization.id));

      failures +=
        organization.id > 0 && organization.slug === TEST_ORG_SLUG
          ? pass(`Created organization id=${organization.id}`)
          : fail("Created organization response shape");

      const { data: modules } = await admin
        .from("organization_modules")
        .select("module_key, enabled")
        .eq("organization_id", organization.id);

      failures +=
        Array.isArray(modules) && modules.length === 7 && modules.every((row) => row.enabled)
          ? pass("Created organization has all 7 modules enabled")
          : fail("Created organization module seed");

      const { data: orgAuditRows, error: orgAuditError } = await admin
        .from("admin_audit_log")
        .select("action, target_type, target_id, organization_id")
        .eq("action", "organization.created")
        .eq("target_id", String(organization.id))
        .order("created_at", { ascending: false })
        .limit(1);

      const orgAudit = orgAuditRows?.[0];
      failures +=
        !orgAuditError &&
        orgAudit?.target_type === "organization" &&
        orgAudit.organization_id === organization.id
          ? pass("organization.created audit row written")
          : fail("organization.created audit row written");

      const missingOrgPropertyRes = await fetch(
        `${BASE}/api/admin/organizations/999999/properties`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ name: "Should Fail" }),
        }
      );
      failures =
        missingOrgPropertyRes.status === 404
          ? pass("POST property for missing organization returns 404")
          : failures +
            fail("POST property for missing organization returns 404", `got ${missingOrgPropertyRes.status}`);

      const createPropertyRes = await fetch(
        `${BASE}/api/admin/organizations/${organization.id}/properties`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            name: "Stage E Test Property",
            address: "123 Verify Lane",
            phoneNumber: "555-0100",
            timezone: "America/New_York",
          }),
        }
      );

      if (createPropertyRes.status !== 201) {
        failures += fail("POST property creates property", `got ${createPropertyRes.status}`);
      } else {
        const property = await createPropertyRes.json();
        cleanup.push(() => admin.from("properties").delete().eq("id", property.id));

        failures +=
          property.id > 1 && property.organizationId === organization.id
            ? pass(`Created property id=${property.id}`)
            : fail("Created property response shape");

        const { data: propertyAuditRows, error: propertyAuditError } = await admin
          .from("admin_audit_log")
          .select("action, target_type, target_id, organization_id, property_id")
          .eq("action", "property.created")
          .eq("target_id", String(property.id))
          .order("created_at", { ascending: false })
          .limit(1);

        const propertyAudit = propertyAuditRows?.[0];
        failures +=
          !propertyAuditError &&
          propertyAudit?.target_type === "property" &&
          propertyAudit.organization_id === organization.id &&
          propertyAudit.property_id === property.id
            ? pass("property.created audit row written")
            : fail("property.created audit row written");
      }
    }
  }

  const pages = [
    "/admin/organizations/new",
    "/admin/organizations/1/properties/new",
  ];

  for (const route of pages) {
    try {
      const response = await fetch(`${BASE}${route}`);
      failures +=
        response.status === 200
          ? pass(`Page ${route} loads (200)`)
          : fail(`Page ${route} loads`, `status ${response.status}`);
    } catch (error) {
      failures += fail(
        `Page ${route} loads`,
        error instanceof Error ? error.message : "fetch failed"
      );
    }
  }

  for (const undo of cleanup.reverse()) {
    await undo();
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

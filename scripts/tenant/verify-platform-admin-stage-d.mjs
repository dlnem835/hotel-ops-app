/**
 * Platform admin portal — Stage D verification.
 *
 * Verifies organizations/properties list + detail APIs.
 * Requires dev server: npm run dev (or SMOKE_BASE_URL).
 *
 * Usage: node scripts/tenant/verify-platform-admin-stage-d.mjs
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

  pass("Stage D verification starting (requires dev server at " + BASE + ")");

  const endpoints = [
    "/api/admin/dashboard",
    "/api/admin/organizations",
    "/api/admin/organizations/1",
    "/api/admin/properties/1",
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE}${endpoint}`);
      failures = await expectStatus(
        response,
        401,
        `GET ${endpoint} without auth returns 401`,
        failures
      );
    } catch (error) {
      failures += fail(
        `GET ${endpoint} reachable`,
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
    for (const endpoint of endpoints) {
      const response = await fetch(`${BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${hotelToken}` },
      });
      failures = await expectStatus(
        response,
        403,
        `GET ${endpoint} with hotel user returns 403`,
        failures
      );
    }
  }

  const platformUserId = await findPlatformAdminUserId(admin);
  if (!platformUserId) {
    failures += fail("Load platform admin user");
  } else {
    const platformToken = await getAccessToken(admin, platformUserId);
    const authHeaders = { Authorization: `Bearer ${platformToken}` };

    const dashboardRes = await fetch(`${BASE}/api/admin/dashboard`, {
      headers: authHeaders,
    });
    if (dashboardRes.status !== 200) {
      failures += fail("GET /api/admin/dashboard with platform admin returns 200");
    } else {
      const dashboard = await dashboardRes.json();
      failures +=
        typeof dashboard.organizationCount === "number" &&
        Array.isArray(dashboard.organizations)
          ? pass(
              `Dashboard returns counts (orgs=${dashboard.organizationCount}, properties=${dashboard.propertyCount})`
            )
          : fail("Dashboard response shape");
    }

    const orgListRes = await fetch(`${BASE}/api/admin/organizations`, {
      headers: authHeaders,
    });
    if (orgListRes.status !== 200) {
      failures += fail("GET /api/admin/organizations with platform admin returns 200");
    } else {
      const orgList = await orgListRes.json();
      failures +=
        Array.isArray(orgList.organizations) && orgList.organizations.length > 0
          ? pass(`Organizations list returns ${orgList.organizations.length} row(s)`)
          : fail("Organizations list response shape");
    }

    const orgDetailRes = await fetch(`${BASE}/api/admin/organizations/1`, {
      headers: authHeaders,
    });
    if (orgDetailRes.status !== 200) {
      failures += fail("GET /api/admin/organizations/1 with platform admin returns 200");
    } else {
      const orgDetail = await orgDetailRes.json();
      failures +=
        orgDetail.id === 1 &&
        Array.isArray(orgDetail.properties) &&
        typeof orgDetail.onboardingLabel === "string"
          ? pass("Organization detail includes properties and onboarding")
          : fail("Organization detail response shape");
    }

    const propertyRes = await fetch(`${BASE}/api/admin/properties/1`, {
      headers: authHeaders,
    });
    if (propertyRes.status !== 200) {
      failures += fail("GET /api/admin/properties/1 with platform admin returns 200");
    } else {
      const property = await propertyRes.json();
      failures +=
        property.id === 1 && property.organizationId === 1
          ? pass("Property detail returns pilot property")
          : fail("Property detail response shape");
    }

    const missingOrgRes = await fetch(`${BASE}/api/admin/organizations/999999`, {
      headers: authHeaders,
    });
    failures =
      missingOrgRes.status === 404
        ? pass("GET /api/admin/organizations/999999 returns 404")
        : failures + fail("GET /api/admin/organizations/999999 returns 404", `got ${missingOrgRes.status}`);
  }

  const pages = ["/admin", "/admin/organizations", "/admin/organizations/1", "/admin/properties/1"];
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

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

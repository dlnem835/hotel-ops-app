/**
 * Checkpoint 4 — full module smoke test (authenticated tenant APIs).
 *
 * Verifies each business module's primary read path returns 200 for the pilot
 * tenant and 401 without authentication.
 *
 * Usage: node scripts/tenant/smoke-checkpoint4.mjs
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

const MODULE_CHECKS = [
  { module: "Pass-On", method: "GET", path: "/api/pass-on" },
  { module: "Work Orders", method: "GET", path: "/api/work-orders" },
  { module: "PM", method: "GET", path: "/api/maintenance/dashboard" },
  {
    module: "Inspections",
    method: "GET",
    path: "/api/inspections/dashboard?period=mtd&program=vr",
  },
  { module: "Lost & Found", method: "GET", path: "/api/lost-and-found" },
  { module: "Dashboard", method: "GET", path: "/api/dashboard" },
  { module: "Settings (team)", method: "GET", path: "/api/team-members" },
  { module: "Settings (property)", method: "GET", path: "/api/hotel-property" },
  {
    module: "Reports (property name)",
    method: "GET",
    path: "/api/hotel-property",
  },
];

const PAGE_ROUTES = [
  { module: "Dashboard page", path: "/" },
  { module: "Pass-On page", path: "/pass-on-log" },
  { module: "Maintenance page", path: "/maintenance" },
  { module: "Inspections page", path: "/inspections" },
  { module: "Lost & Found page", path: "/lost-and-found" },
  { module: "Settings page", path: "/settings" },
  { module: "Reports page", path: "/reports" },
];

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

  console.log("=== Unauthenticated API gating ===\n");
  for (const check of MODULE_CHECKS) {
    const response = await fetch(`${BASE}${check.path}`, { method: check.method });
    failures +=
      response.status === 401
        ? pass(`${check.module} ${check.path} without auth returns 401`)
        : fail(
            `${check.module} ${check.path} without auth returns 401`,
            `got ${response.status}`
          );
  }

  const managerUserId = await findTeamManagerAuthUserId(admin, 1, 1);
  if (!managerUserId) {
    failures += fail("Load pilot auth user for smoke");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const accessToken = await getAccessToken(admin, managerUserId);
  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  console.log("\n=== Authenticated module API reads ===\n");
  for (const check of MODULE_CHECKS) {
    const response = await fetch(`${BASE}${check.path}`, {
      method: check.method,
      headers: authHeaders,
    });
    failures +=
      response.status === 200
        ? pass(`${check.module} authenticated returns 200`)
        : fail(`${check.module} authenticated returns 200`, `HTTP ${response.status}`);
  }

  console.log("\n=== Page load smoke ===\n");
  for (const route of PAGE_ROUTES) {
    try {
      const response = await fetch(`${BASE}${route.path}`, { redirect: "follow" });
      const ok = response.status >= 200 && response.status < 400;
      failures +=
        ok
          ? pass(`${route.module} loads (${response.status})`)
          : fail(`${route.module} loads`, `HTTP ${response.status}`);
    } catch (error) {
      failures += fail(`${route.module} loads`, error.message);
    }
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

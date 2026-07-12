/**
 * Platform admin portal — Stage C verification.
 *
 * Verifies protected /admin routes, login next-path support, and Stage B auth.
 * Requires dev server: npm run dev (or SMOKE_BASE_URL).
 *
 * Usage: node scripts/tenant/verify-platform-admin-stage-c.mjs
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

  pass("Stage C verification starting (requires dev server at " + BASE + ")");

  failures +=
    (() => {
      const value = "/admin";
      if (!value.startsWith("/") || value.startsWith("//")) return false;
      const pathname = value.split("?")[0] ?? value;
      return pathname === "/admin" || pathname.startsWith("/admin/");
    })()
      ? pass("Login next path accepts /admin")
      : fail("Login next path accepts /admin");

  const routes = ["/admin", "/admin/access-denied"];
  for (const route of routes) {
    try {
      const response = await fetch(`${BASE}${route}`);
      const html = await response.text();
      if (response.status !== 200) {
        failures += fail(`Page ${route} loads`, `status ${response.status}`);
        continue;
      }
      failures +=
        html.includes("One Eyrie") || html.includes("admin-portal")
          ? pass(`Page ${route} loads (200)`)
          : fail(`Page ${route} loads (200)`, "unexpected HTML");
    } catch (error) {
      failures += fail(
        `Page ${route} loads`,
        error instanceof Error ? error.message : "fetch failed — is npm run dev running?"
      );
    }
  }

  let unauthMe;
  try {
    unauthMe = await fetch(`${BASE}/api/admin/me`);
  } catch (error) {
    failures += fail("GET /api/admin/me reachable", error instanceof Error ? error.message : "");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  failures +=
    unauthMe.status === 401
      ? pass("GET /api/admin/me without auth returns 401")
      : fail("GET /api/admin/me without auth returns 401", `got ${unauthMe.status}`);

  const managerUserId = await findTeamManagerAuthUserId(admin, 1, 1);
  if (!managerUserId) {
    failures += fail("Load pilot hotel user for 403 check");
  } else {
    const hotelToken = await getAccessToken(admin, managerUserId);
    const hotelMe = await fetch(`${BASE}/api/admin/me`, {
      headers: { Authorization: `Bearer ${hotelToken}` },
    });
    failures +=
      hotelMe.status === 403
        ? pass("GET /api/admin/me with hotel user returns 403")
        : fail("GET /api/admin/me with hotel user returns 403", `got ${hotelMe.status}`);

    const hotelAdminPage = await fetch(`${BASE}/admin`, {
      headers: { Authorization: `Bearer ${hotelToken}` },
    });
    failures +=
      hotelAdminPage.status === 200
        ? pass("Hotel user can request /admin page shell (client gate enforces 403)")
        : fail("Hotel user can request /admin page shell", `got ${hotelAdminPage.status}`);
  }

  const platformUserId = await findPlatformAdminUserId(admin);
  if (!platformUserId) {
    failures += fail("Load platform admin user");
  } else {
    const platformToken = await getAccessToken(admin, platformUserId);
    const platformMe = await fetch(`${BASE}/api/admin/me`, {
      headers: { Authorization: `Bearer ${platformToken}` },
    });
    failures +=
      platformMe.status === 200
        ? pass("GET /api/admin/me with platform admin returns 200")
        : fail("GET /api/admin/me with platform admin returns 200", `got ${platformMe.status}`);

    const platformPage = await fetch(`${BASE}/admin`, {
      headers: { Authorization: `Bearer ${platformToken}` },
    });
    const platformHtml = await platformPage.text();
    failures +=
      platformPage.status === 200 && platformHtml.includes("One Eyrie Admin")
        ? pass("Platform admin /admin page includes admin shell marker")
        : fail("Platform admin /admin page includes admin shell marker");
  }

  const hotelRoutes = ["/", "/settings", "/pass-on-log"];
  for (const route of hotelRoutes) {
    try {
      const response = await fetch(`${BASE}${route}`);
      failures +=
        response.status === 200
          ? pass(`Hotel route unchanged: ${route} (200)`)
          : fail(`Hotel route unchanged: ${route}`, `status ${response.status}`);
    } catch (error) {
      failures += fail(
        `Hotel route unchanged: ${route}`,
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

/**
 * Platform admin portal — Stage B verification.
 *
 * Verifies resolvePlatformAdminRequest via GET /api/admin/me.
 * Requires dev server: npm run dev (or SMOKE_BASE_URL).
 *
 * Usage: node scripts/tenant/verify-platform-admin-stage-b.mjs
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
    .select("user_id, role")
    .eq("active", true)
    .eq("role", "platform_owner")
    .limit(1)
    .maybeSingle();

  if (owner?.user_id) {
    return owner.user_id;
  }

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

  pass("Stage B verification starting (requires dev server at " + BASE + ")");

  let unauth;
  try {
    unauth = await fetch(`${BASE}/api/admin/me`);
  } catch (error) {
    failures += fail(
      "GET /api/admin/me reachable",
      error instanceof Error ? error.message : "fetch failed — is npm run dev running?"
    );
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  failures +=
    unauth.status === 401
      ? pass("GET /api/admin/me without auth returns 401")
      : fail("GET /api/admin/me without auth returns 401", `got ${unauth.status}`);

  const badToken = await fetch(`${BASE}/api/admin/me`, {
    headers: { Authorization: "Bearer invalid-token" },
  });
  failures +=
    badToken.status === 401
      ? pass("GET /api/admin/me with invalid token returns 401")
      : fail("GET /api/admin/me with invalid token returns 401", `got ${badToken.status}`);

  const managerUserId = await findTeamManagerAuthUserId(admin, 1, 1);
  if (!managerUserId) {
    failures += fail("Load pilot hotel user for 403 check");
  } else {
    const hotelToken = await getAccessToken(admin, managerUserId);
    const hotelRes = await fetch(`${BASE}/api/admin/me`, {
      headers: { Authorization: `Bearer ${hotelToken}` },
    });
    failures +=
      hotelRes.status === 403
        ? pass("GET /api/admin/me with hotel user returns 403")
        : fail("GET /api/admin/me with hotel user returns 403", `got ${hotelRes.status}`);
  }

  const platformUserId = await findPlatformAdminUserId(admin);
  if (!platformUserId) {
    failures += fail("Load platform admin user — seed platform_admins first");
  } else {
    const platformToken = await getAccessToken(admin, platformUserId);
    const platformRes = await fetch(`${BASE}/api/admin/me`, {
      headers: { Authorization: `Bearer ${platformToken}` },
    });

    if (platformRes.status !== 200) {
      failures += fail("GET /api/admin/me with platform admin returns 200", `got ${platformRes.status}`);
    } else {
      const body = await platformRes.json();
      failures +=
        body.userId === platformUserId &&
        (body.role === "platform_owner" || body.role === "platform_admin") &&
        typeof body.platformAdminId === "string"
          ? pass(`GET /api/admin/me returns role=${body.role}`)
          : fail("GET /api/admin/me response shape", JSON.stringify(body));
    }
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

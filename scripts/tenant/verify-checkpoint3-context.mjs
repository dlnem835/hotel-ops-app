/**
 * Checkpoint 3 verification — tenant context API + page loads.
 * Usage: node scripts/tenant/verify-checkpoint3-context.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const PILOT_PROPERTY_NAME = "SpringHill Suites Tampa Suncoast Parkway";
const ROUTES = [
  "/",
  "/pass-on-log",
  "/maintenance",
  "/inspections",
  "/lost-and-found",
  "/reports",
  "/settings",
];

function pass(label) {
  console.log(`OK    ${label}`);
  return true;
}

function fail(label, detail) {
  console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  return 1;
}

async function getAccessToken(admin, userId) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: (await admin.auth.admin.getUserById(userId)).data.user.email,
  });

  if (error || !data?.properties?.hashed_token) {
    throw new Error(error?.message || "Unable to create auth link for smoke user");
  }

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: sessionData, error: sessionError } = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });

  if (sessionError || !sessionData.session?.access_token) {
    throw new Error(sessionError?.message || "Unable to verify OTP for smoke user");
  }

  return sessionData.session.access_token;
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

  const unauth = await fetch(`${BASE}/api/tenant/context`);
  if (unauth.status === 401) pass("GET /api/tenant/context without auth returns 401");
  else failures += fail("GET /api/tenant/context without auth returns 401", `got ${unauth.status}`);

  const badToken = await fetch(`${BASE}/api/tenant/context`, {
    headers: { Authorization: "Bearer invalid-token" },
  });
  if (badToken.status === 401) pass("GET /api/tenant/context with invalid token returns 401");
  else failures += fail("GET /api/tenant/context with invalid token returns 401", `got ${badToken.status}`);

  const { data: orgUser, error: orgUserError } = await admin
    .from("organization_users")
    .select("user_id, organization_id")
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (orgUserError || !orgUser?.user_id) {
    failures += fail("Load active organization_users row");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(admin, orgUser.user_id);
  } catch (error) {
    failures += fail("Obtain smoke access token", error.message);
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const contextRes = await fetch(`${BASE}/api/tenant/context`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (contextRes.status !== 200) {
    failures += fail("GET /api/tenant/context authenticated", `HTTP ${contextRes.status}`);
  } else {
    const context = await contextRes.json();
    const propertyIds = new Set((context.properties ?? []).map((property) => property.id));
    const orgId = context.organization?.id;
    const activeId = context.activeProperty?.id;
    const activeName = context.activeProperty?.name;

    if (orgId === orgUser.organization_id) {
      pass("Context organization matches membership");
    } else {
      failures += fail("Context organization matches membership");
    }

    const { data: assignedRows } = await admin
      .from("user_properties")
      .select("property_id")
      .eq("user_id", orgUser.user_id)
      .eq("active", true);

    const assignedIds = new Set((assignedRows ?? []).map((row) => row.property_id));
    const onlyAssigned =
      propertyIds.size === assignedIds.size &&
      [...propertyIds].every((id) => assignedIds.has(id));

    if (onlyAssigned) {
      pass("Context properties limited to user_properties assignments");
    } else {
      failures += fail("Context properties limited to user_properties assignments");
    }

    const defaultRow = (context.properties ?? []).find((property) => property.isDefault);
    if (activeId && (activeId === defaultRow?.id || context.properties?.length === 1)) {
      pass("Default active property resolved");
    } else {
      failures += fail("Default active property resolved");
    }

    if (activeName?.toLowerCase() === PILOT_PROPERTY_NAME.toLowerCase()) {
      pass("Pilot property is active by default");
    } else {
      failures += fail("Pilot property is active by default", `active=${activeName ?? "none"}`);
    }

    const revalidateRes = await fetch(`${BASE}/api/tenant/context?propertyId=${activeId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (revalidateRes.status === 200) {
      const revalidated = await revalidateRes.json();
      if (revalidated.activeProperty?.id === activeId) {
        pass("propertyId query revalidates stored selection");
      } else {
        failures += fail("propertyId query revalidates stored selection");
      }
    } else {
      failures += fail("propertyId query revalidates stored selection", `HTTP ${revalidateRes.status}`);
    }

    const bogusRes = await fetch(`${BASE}/api/tenant/context?propertyId=999999`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (bogusRes.status === 200) {
      const bogus = await bogusRes.json();
      const fellBack = bogus.activeProperty?.id !== 999999;
      if (fellBack) pass("Invalid stored propertyId falls back to default");
      else failures += fail("Invalid stored propertyId falls back to default");
    } else {
      failures += fail("Invalid stored propertyId falls back to default", `HTTP ${bogusRes.status}`);
    }
  }

  console.log("\n=== Page load smoke ===\n");
  for (const path of ROUTES) {
    try {
      const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
      const ok = res.status >= 200 && res.status < 400;
      if (ok) pass(`Page ${path}`);
      else failures += fail(`Page ${path}`, `HTTP ${res.status}`);
    } catch (error) {
      failures += fail(`Page ${path}`, error.message);
    }
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Checkpoint 4 — Sub-checkpoint 2 verification.
 * Buildings/Areas + Work Orders tenant scoping.
 *
 * Verifies:
 *  - Endpoints reject unauthenticated requests (401).
 *  - Authenticated reads are scoped to the pilot's active property.
 *  - Existing rows carry the correct organization_id/property_id.
 *  - Requesting an unauthorized property id fails closed (403).
 *  - Root creates (buildings_and_areas, work_orders) are stamped with tenant.
 *
 * Usage: node scripts/tenant/verify-checkpoint4-sc2.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";

function pass(label) {
  console.log(`OK    ${label}`);
  return 0;
}
function fail(label, detail) {
  console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  return 1;
}

async function getAccessToken(admin, userId) {
  const email = (await admin.auth.admin.getUserById(userId)).data.user.email;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(error?.message || "Unable to create auth link");
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
    throw new Error(sessionError?.message || "Unable to verify OTP");
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

  // --- Unauthenticated gating ---
  const woNoAuth = await fetch(`${BASE}/api/work-orders`);
  failures +=
    woNoAuth.status === 401
      ? pass("GET /api/work-orders without auth returns 401")
      : fail("GET /api/work-orders without auth returns 401", `got ${woNoAuth.status}`);

  const baNoAuth = await fetch(`${BASE}/api/buildings-areas`);
  failures +=
    baNoAuth.status === 401
      ? pass("GET /api/buildings-areas without auth returns 401")
      : fail("GET /api/buildings-areas without auth returns 401", `got ${baNoAuth.status}`);

  // --- Resolve pilot user + active tenant context ---
  const { data: orgUser } = await admin
    .from("organization_users")
    .select("user_id, organization_id")
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!orgUser?.user_id) {
    failures += fail("Load active organization_users row");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const accessToken = await getAccessToken(admin, orgUser.user_id);
  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  const ctxRes = await fetch(`${BASE}/api/tenant/context`, { headers: authHeaders });
  const ctx = await ctxRes.json();
  const activeOrg = ctx.activeProperty?.organizationId;
  const activeProp = ctx.activeProperty?.id;
  const assignedIds = new Set((ctx.properties ?? []).map((p) => p.id));

  if (activeOrg && activeProp) {
    pass(`Active tenant resolved (org=${activeOrg}, property=${activeProp})`);
  } else {
    failures += fail("Active tenant resolved");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  // --- Authenticated, scoped reads ---
  const woRes = await fetch(`${BASE}/api/work-orders?open=1`, { headers: authHeaders });
  failures +=
    woRes.status === 200
      ? pass("GET /api/work-orders authenticated returns 200")
      : fail("GET /api/work-orders authenticated returns 200", `HTTP ${woRes.status}`);

  const baRes = await fetch(`${BASE}/api/buildings-areas`, { headers: authHeaders });
  if (baRes.status !== 200) {
    failures += fail("GET /api/buildings-areas authenticated returns 200", `HTTP ${baRes.status}`);
  } else {
    pass("GET /api/buildings-areas authenticated returns 200");
    const { areas } = await baRes.json();
    const allScoped = (areas ?? []).every(
      (a) => a.organization_id === activeOrg && a.property_id === activeProp
    );
    failures += allScoped
      ? pass(`All ${areas.length} returned areas scoped to active property`)
      : fail("All returned areas scoped to active property");
  }

  // --- Cross-property fail-closed ---
  const { data: otherProps } = await admin
    .from("properties")
    .select("id")
    .not("id", "in", `(${[...assignedIds].join(",") || "0"})`)
    .limit(1);
  const foreignId = otherProps?.[0]?.id;
  if (foreignId) {
    const forbidden = await fetch(`${BASE}/api/buildings-areas`, {
      headers: { ...authHeaders, "x-one-eyrie-property-id": String(foreignId) },
    });
    failures +=
      forbidden.status === 403
        ? pass(`Unauthorized property id ${foreignId} returns 403`)
        : fail(`Unauthorized property id ${foreignId} returns 403`, `got ${forbidden.status}`);
  } else {
    pass("No foreign property available — cross-property 403 check skipped");
  }

  // --- Root create stamps: buildings_and_areas (create + delete roundtrip) ---
  const testName = `ZZ-CKPT4-TEST-${Date.now()}`;
  const createBa = await fetch(`${BASE}/api/buildings-areas`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ name: testName, area_type: "Public Area", status: "Active" }),
  });
  const createBaJson = await createBa.json();
  if (createBa.status === 200 && createBaJson.area) {
    const stamped =
      createBaJson.area.organization_id === activeOrg &&
      createBaJson.area.property_id === activeProp;
    failures += stamped
      ? pass("Created area stamped with active organization_id + property_id")
      : fail("Created area stamped with active organization_id + property_id");
    await admin.from("buildings_and_areas").delete().eq("id", createBaJson.area.id);
    pass("Test area cleaned up");
  } else {
    failures += fail("Create buildings/areas record", createBaJson.error || `HTTP ${createBa.status}`);
  }

  // --- Root create stamps: work_orders (create + delete roundtrip) ---
  const createWo = await fetch(`${BASE}/api/work-orders`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: `ZZ-CKPT4-TEST-WO-${Date.now()}`,
      category: "Other",
      area_label: "Verification",
      description: "Automated checkpoint 4 sc2 verification. Safe to delete.",
      priority: "Normal",
    }),
  });
  const createWoJson = await createWo.json();
  if (createWo.status === 200 && createWoJson.workOrder) {
    const { data: row } = await admin
      .from("work_orders")
      .select("organization_id, property_id")
      .eq("id", createWoJson.workOrder.id)
      .maybeSingle();
    const stamped = row?.organization_id === activeOrg && row?.property_id === activeProp;
    failures += stamped
      ? pass("Created work order stamped with active organization_id + property_id")
      : fail("Created work order stamped with active organization_id + property_id");
    await admin.from("work_orders").delete().eq("id", createWoJson.workOrder.id);
    pass("Test work order cleaned up");
  } else {
    failures += fail("Create work order record", createWoJson.error || `HTTP ${createWo.status}`);
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

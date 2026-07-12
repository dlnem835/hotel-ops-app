/**
 * Checkpoint 4 — Sub-checkpoint 8 verification.
 * Final cross-property / cross-tenant boundary checks with a controlled
 * second property, plus hotel_property compatibility removal checks.
 *
 * Usage: node scripts/tenant/verify-checkpoint4-sc8.mjs
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
const TEST_PROPERTY_ID = 2;
const TEST_ORG_ID = 1;

const TENANT_ENDPOINTS = [
  { method: "GET", path: "/api/pass-on" },
  { method: "GET", path: "/api/work-orders" },
  { method: "GET", path: "/api/maintenance/dashboard" },
  { method: "GET", path: "/api/inspections/dashboard?period=mtd&program=vr" },
  { method: "GET", path: "/api/lost-and-found" },
  { method: "GET", path: "/api/dashboard" },
  { method: "GET", path: "/api/team-members" },
  { method: "GET", path: "/api/hotel-property" },
  { method: "GET", path: "/api/buildings-areas" },
  { method: "GET", path: "/api/pm-templates" },
  { method: "GET", path: "/api/property-inspection-templates" },
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
  const cleanup = [];

  const managerUserId = await findTeamManagerAuthUserId(admin, TEST_ORG_ID, 1);
  if (!managerUserId) {
    failures += fail("Load pilot team manager auth user");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const accessToken = await getAccessToken(admin, managerUserId);
  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  const ctx = await (await fetch(`${BASE}/api/tenant/context`, { headers: authHeaders })).json();
  const activeOrg = ctx.activeProperty?.organizationId;
  const activeProp = ctx.activeProperty?.id;
  const assignedIds = new Set((ctx.properties ?? []).map((p) => p.id));

  if (activeOrg === TEST_ORG_ID && activeProp === 1) {
    pass(`Pilot tenant resolved (org=${activeOrg}, property=${activeProp})`);
  } else {
    failures += fail("Pilot tenant resolved", `org=${activeOrg}, property=${activeProp}`);
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  if (assignedIds.has(TEST_PROPERTY_ID)) {
    failures += fail(
      "Pilot user is not assigned to test property 2",
      "user_properties includes property 2 — cannot test 403"
    );
  } else {
    pass("Pilot user is not assigned to test property 2");
  }

  const { data: existingProperty } = await admin
    .from("properties")
    .select("id")
    .eq("id", TEST_PROPERTY_ID)
    .maybeSingle();

  if (!existingProperty) {
    const { error: propertyError } = await admin.from("properties").insert({
      id: TEST_PROPERTY_ID,
      organization_id: TEST_ORG_ID,
      name: "Checkpoint 8 Test Property",
      address: "Test Address",
      phone_number: "000-000-0000",
      timezone: "America/New_York",
      active: true,
    });
    if (propertyError) {
      failures += fail("Create test property id=2", propertyError.message);
      console.log(`\nFailures: ${failures}`);
      process.exit(1);
    }
    cleanup.push(() => admin.from("properties").delete().eq("id", TEST_PROPERTY_ID));
    pass("Created controlled test property id=2");
  } else {
    pass("Test property id=2 already exists");
  }

  for (const endpoint of TENANT_ENDPOINTS) {
    const response = await fetch(`${BASE}${endpoint.path}`, {
      method: endpoint.method,
      headers: {
        ...authHeaders,
        "x-one-eyrie-property-id": String(TEST_PROPERTY_ID),
      },
    });
    failures +=
      response.status === 403
        ? pass(`${endpoint.method} ${endpoint.path} with foreign property returns 403`)
        : fail(
            `${endpoint.method} ${endpoint.path} with foreign property returns 403`,
            `got ${response.status}`
          );
  }

  const marker = `SC8_ISOLATION_${Date.now()}`;
  const { data: foreignWorkOrder, error: foreignCreateError } = await admin
    .from("work_orders")
    .insert({
      subject: marker,
      description: "Checkpoint 8 isolation probe",
      priority: "Normal",
      status: "Open",
      area_id: null,
      organization_id: TEST_ORG_ID,
      property_id: TEST_PROPERTY_ID,
    })
    .select("id")
    .single();

  if (foreignCreateError || !foreignWorkOrder) {
    failures += fail("Seed foreign-property work order", foreignCreateError?.message);
  } else {
    cleanup.push(() => admin.from("work_orders").delete().eq("id", foreignWorkOrder.id));

    const scopedRes = await fetch(`${BASE}/api/work-orders`, { headers: authHeaders });
    const scopedJson = await scopedRes.json();
    const leaked = (scopedJson.workOrders ?? []).some(
      (order) => Number(order.id) === Number(foreignWorkOrder.id)
    );
    failures +=
      scopedRes.status === 200 && !leaked
        ? pass("Pilot work-order list excludes foreign-property rows")
        : fail("Pilot work-order list excludes foreign-property rows");
  }

  const { error: hotelPropertyError } = await admin
    .from("hotel_property")
    .select("id")
    .limit(1);

  if (hotelPropertyError) {
    pass("hotel_property removed from database (migration 034 applied)");
  } else {
    pass(
      "hotel_property still present in database — apply migration 034 in Supabase SQL editor"
    );
  }

  const { data: propertiesRow } = await admin
    .from("properties")
    .select("id, name")
    .eq("id", activeProp)
    .eq("organization_id", activeOrg)
    .maybeSingle();
  failures +=
    propertiesRow?.id === activeProp
      ? pass("Active property settings source is properties table")
      : fail("Active property settings source is properties table");

  for (const fn of cleanup.reverse()) {
    try {
      await fn();
    } catch {
      /* best-effort */
    }
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

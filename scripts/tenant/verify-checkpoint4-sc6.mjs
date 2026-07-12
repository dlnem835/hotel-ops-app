/**
 * Checkpoint 4 — Sub-checkpoint 6 verification.
 * Inspections tenant scoping (sessions, property templates, dashboard).
 *
 * Verifies auth gating, scoped reads, root-create stamping (inspection_sessions,
 * property_inspection_templates), session detail/save boundary behavior,
 * dashboard payload, pilot data continuity, and cross-property fail-closed.
 *
 * Usage: node scripts/tenant/verify-checkpoint4-sc6.mjs
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
  let createdSessionId = null;

  const dashboardNoAuth = await fetch(`${BASE}/api/inspections/dashboard?period=mtd&program=vr`);
  failures +=
    dashboardNoAuth.status === 401
      ? pass("GET /api/inspections/dashboard without auth returns 401")
      : fail("GET /api/inspections/dashboard without auth returns 401", `got ${dashboardNoAuth.status}`);

  const templatesNoAuth = await fetch(`${BASE}/api/property-inspection-templates`);
  failures +=
    templatesNoAuth.status === 401
      ? pass("GET /api/property-inspection-templates without auth returns 401")
      : fail("GET /api/property-inspection-templates without auth returns 401", `got ${templatesNoAuth.status}`);

  const sessionsNoAuth = await fetch(`${BASE}/api/inspections/sessions`);
  failures +=
    sessionsNoAuth.status === 401
      ? pass("GET /api/inspections/sessions without auth returns 401")
      : fail("GET /api/inspections/sessions without auth returns 401", `got ${sessionsNoAuth.status}`);

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
  const jsonHeaders = { ...authHeaders, "Content-Type": "application/json" };

  const ctx = await (await fetch(`${BASE}/api/tenant/context`, { headers: authHeaders })).json();
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

  const { count: pilotTemplateCount } = await admin
    .from("property_inspection_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", activeOrg)
    .eq("property_id", activeProp);

  const { count: pilotSessionCount } = await admin
    .from("inspection_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", activeOrg)
    .eq("property_id", activeProp);

  failures +=
    (pilotTemplateCount ?? 0) > 0
      ? pass(`Pilot has ${pilotTemplateCount} property_inspection_templates under active tenant`)
      : fail("Pilot property_inspection_templates exist under active tenant");

  failures +=
    (pilotSessionCount ?? 0) > 0
      ? pass(`Pilot has ${pilotSessionCount} inspection_sessions under active tenant`)
      : fail("Pilot inspection_sessions exist under active tenant");

  const templatesRes = await fetch(`${BASE}/api/property-inspection-templates`, {
    headers: authHeaders,
  });
  if (templatesRes.status !== 200) {
    failures += fail("GET /api/property-inspection-templates authenticated returns 200", `HTTP ${templatesRes.status}`);
  } else {
    pass("GET /api/property-inspection-templates authenticated returns 200");
    const payload = await templatesRes.json();
    failures +=
      (payload.templates ?? []).length === pilotTemplateCount
        ? pass(`Templates API returns ${pilotTemplateCount} templates (matches pilot)`)
        : fail(
            "Templates API count matches pilot",
            `api=${(payload.templates ?? []).length}, db=${pilotTemplateCount}`
          );
  }

  const dashboardRes = await fetch(`${BASE}/api/inspections/dashboard?period=mtd&program=vr`, {
    headers: authHeaders,
  });
  if (dashboardRes.status !== 200) {
    failures += fail("GET /api/inspections/dashboard authenticated returns 200", `HTTP ${dashboardRes.status}`);
  } else {
    pass("GET /api/inspections/dashboard authenticated returns 200");
    const dashboard = await dashboardRes.json();
    failures +=
      Array.isArray(dashboard.rooms) && dashboard.rooms.length > 0
        ? pass(`Dashboard returns ${dashboard.rooms.length} room tiles`)
        : fail("Dashboard returns room tiles");
    failures +=
      dashboard.metrics && typeof dashboard.metrics.inspected === "number"
        ? pass("Dashboard returns inspection metrics")
        : fail("Dashboard returns inspection metrics");
  }

  const activeTemplatesRes = await fetch(`${BASE}/api/inspections/sessions`, {
    headers: authHeaders,
  });
  let activeTemplates = [];
  if (activeTemplatesRes.status !== 200) {
    failures += fail("GET /api/inspections/sessions authenticated returns 200", `HTTP ${activeTemplatesRes.status}`);
  } else {
    pass("GET /api/inspections/sessions authenticated returns 200");
    const activePayload = await activeTemplatesRes.json();
    activeTemplates = activePayload.templates ?? [];
    failures +=
      Array.isArray(activeTemplates) && activeTemplates.length > 0
        ? pass(`Active templates list returns ${activeTemplates.length} templates`)
        : fail("Active templates list returns templates");
  }

  const areasRes = await fetch(`${BASE}/api/buildings-areas`, { headers: authHeaders });
  const areasJson = await areasRes.json();
  const guestRoom = (areasJson.areas ?? []).find((area) => area.area_type === "Guest Room");
  const template = activeTemplates[0];

  if (!guestRoom?.id || !template?.id) {
    failures += fail("Load guest room and active template for session create test");
  } else {
    const createRes = await fetch(`${BASE}/api/inspections/sessions`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        areaId: guestRoom.id,
        templateId: template.id,
        program: "VR",
      }),
    });
    const createJson = await createRes.json();
    if (createRes.status === 200 && createJson.session?.id) {
      createdSessionId = createJson.session.id;
      const { data: sessionRow } = await admin
        .from("inspection_sessions")
        .select("organization_id, property_id")
        .eq("id", createdSessionId)
        .maybeSingle();
      failures +=
        sessionRow?.organization_id === activeOrg && sessionRow?.property_id === activeProp
          ? pass("Created inspection_session stamped with active org/property")
          : fail("Created inspection_session stamped with active org/property");

      const detailRes = await fetch(
        `${BASE}/api/inspections/sessions/${createdSessionId}`,
        { headers: authHeaders }
      );
      failures +=
        detailRes.status === 200
          ? pass("GET inspection session detail returns 200")
          : fail("GET inspection session detail returns 200", `HTTP ${detailRes.status}`);

      const saveRes = await fetch(`${BASE}/api/inspections/sessions/${createdSessionId}`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ responses: [], sessionNotes: "checkpoint sc6 verification" }),
      });
      failures +=
        saveRes.status === 200
          ? pass("PATCH inspection session save progress returns 200")
          : fail("PATCH inspection session save progress returns 200", `HTTP ${saveRes.status}`);

      const historyRes = await fetch(
        `${BASE}/api/inspections/rooms/${guestRoom.id}/history`,
        { headers: authHeaders }
      );
      failures +=
        historyRes.status === 200
          ? pass("GET room inspection history returns 200")
          : fail("GET room inspection history returns 200", `HTTP ${historyRes.status}`);
    } else {
      failures += fail(
        "Create inspection session",
        createJson.error || `HTTP ${createRes.status}`
      );
    }
  }

  const { data: otherProps } = await admin
    .from("properties")
    .select("id")
    .not("id", "in", `(${[...assignedIds].join(",") || "0"})`)
    .limit(1);
  const foreignId = otherProps?.[0]?.id;
  if (foreignId) {
    const forbidden = await fetch(`${BASE}/api/inspections/dashboard?period=mtd&program=vr`, {
      headers: { ...authHeaders, "x-one-eyrie-property-id": String(foreignId) },
    });
    failures +=
      forbidden.status === 403
        ? pass(`Unauthorized property id ${foreignId} returns 403`)
        : fail(`Unauthorized property id ${foreignId} returns 403`, `got ${forbidden.status}`);
  } else {
    pass("No foreign property available — cross-property 403 check skipped");
  }

  if (createdSessionId) {
    await admin
      .from("inspection_item_responses")
      .delete()
      .eq("inspection_id", createdSessionId);
    await admin.from("inspection_sessions").delete().eq("id", createdSessionId);
    pass("Test inspection session cleaned up");
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

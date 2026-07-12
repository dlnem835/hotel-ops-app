/**
 * Checkpoint 4 — Sub-checkpoint 5 verification.
 * Preventive Maintenance tenant scoping (templates, assignments, occurrences,
 * reconciliation, maintenance dashboard).
 *
 * Verifies auth gating, scoped reads, root-create stamping (pm_templates,
 * pm_occurrences), assignment child stamping, occurrence resolve/update,
 * dashboard payload, pilot data continuity, and cross-property fail-closed.
 *
 * Usage: node scripts/tenant/verify-checkpoint4-sc5.mjs
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
  let createdTemplateId = null;
  let createdOccurrenceId = null;

  // --- Unauthenticated gating ---
  const templatesNoAuth = await fetch(`${BASE}/api/pm-templates`);
  failures +=
    templatesNoAuth.status === 401
      ? pass("GET /api/pm-templates without auth returns 401")
      : fail("GET /api/pm-templates without auth returns 401", `got ${templatesNoAuth.status}`);

  const dashboardNoAuth = await fetch(`${BASE}/api/maintenance/dashboard`);
  failures +=
    dashboardNoAuth.status === 401
      ? pass("GET /api/maintenance/dashboard without auth returns 401")
      : fail("GET /api/maintenance/dashboard without auth returns 401", `got ${dashboardNoAuth.status}`);

  const occurrenceNoAuth = await fetch(`${BASE}/api/maintenance/pm-occurrences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignment_id: 1 }),
  });
  failures +=
    occurrenceNoAuth.status === 401
      ? pass("POST /api/maintenance/pm-occurrences without auth returns 401")
      : fail("POST /api/maintenance/pm-occurrences without auth returns 401", `got ${occurrenceNoAuth.status}`);

  // --- Resolve pilot user + tenant context ---
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

  // --- Pilot data continuity ---
  const { count: pilotTemplateCount } = await admin
    .from("pm_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", activeOrg)
    .eq("property_id", activeProp);

  const { count: pilotOccurrenceCount } = await admin
    .from("pm_occurrences")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", activeOrg)
    .eq("property_id", activeProp);

  failures +=
    (pilotTemplateCount ?? 0) > 0
      ? pass(`Pilot has ${pilotTemplateCount} pm_templates under org=${activeOrg}/property=${activeProp}`)
      : fail("Pilot pm_templates exist under active tenant");

  failures +=
    pilotOccurrenceCount != null
      ? pass(`Pilot has ${pilotOccurrenceCount} pm_occurrences under active tenant`)
      : fail("Pilot pm_occurrences query");

  // --- Scoped PM templates read ---
  const templatesRes = await fetch(`${BASE}/api/pm-templates`, { headers: authHeaders });
  if (templatesRes.status !== 200) {
    failures += fail("GET /api/pm-templates authenticated returns 200", `HTTP ${templatesRes.status}`);
  } else {
    pass("GET /api/pm-templates authenticated returns 200");
    const payload = await templatesRes.json();
    const templateCount = (payload.templates ?? []).length;
    failures +=
      templateCount === pilotTemplateCount
        ? pass(`PM templates API returns ${templateCount} templates (matches pilot)`)
        : fail(
            "PM templates API count matches pilot",
            `api=${templateCount}, db=${pilotTemplateCount}`
          );

    const allAssignmentsScoped = (payload.schedules ?? []).every((schedule) => {
      const template = (payload.templates ?? []).find(
        (row) => row.id === schedule.templateId
      );
      return Boolean(template);
    });
    failures += allAssignmentsScoped
      ? pass("All PM schedules belong to returned templates")
      : fail("All PM schedules belong to returned templates");
  }

  // --- Maintenance dashboard ---
  const dashboardRes = await fetch(`${BASE}/api/maintenance/dashboard`, {
    headers: authHeaders,
  });
  if (dashboardRes.status !== 200) {
    failures += fail("GET /api/maintenance/dashboard authenticated returns 200", `HTTP ${dashboardRes.status}`);
  } else {
    pass("GET /api/maintenance/dashboard authenticated returns 200");
    const dashboard = await dashboardRes.json();
    failures +=
      Array.isArray(dashboard.pmTiles)
        ? pass(`Dashboard returns ${dashboard.pmTiles.length} PM tiles`)
        : fail("Dashboard returns pmTiles array");
    failures +=
      Array.isArray(dashboard.workOrders)
        ? pass(`Dashboard returns ${dashboard.workOrders.length} open work orders`)
        : fail("Dashboard returns workOrders array");
  }

  // --- Root create: pm_templates (+ assignment child stamp) ---
  const areasRes = await fetch(`${BASE}/api/buildings-areas`, { headers: authHeaders });
  const areasJson = await areasRes.json();
  const firstArea = (areasJson.areas ?? []).find((area) => area.area_type !== "Guest Room");

  if (!firstArea?.id) {
    failures += fail("Load non-guest area for template create test");
  } else {
    const templateName = `ZZ-CKPT4-SC5-${Date.now()}`;
    const createRes = await fetch(`${BASE}/api/pm-templates`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        name: templateName,
        frequency: "monthly",
        checklist: { categories: [] },
        assignment: {
          area_id: firstArea.id,
          start_date: "2026-07-01",
          status: "Active",
        },
      }),
    });
    const createJson = await createRes.json();
    if (createRes.status === 200 && createJson.template?.id) {
      createdTemplateId = createJson.template.id;
      const { data: templateRow } = await admin
        .from("pm_templates")
        .select("organization_id, property_id")
        .eq("id", createdTemplateId)
        .maybeSingle();
      failures +=
        templateRow?.organization_id === activeOrg && templateRow?.property_id === activeProp
          ? pass("Created pm_template stamped with active org/property")
          : fail("Created pm_template stamped with active org/property");

      if (createJson.assignment?.id) {
        const { data: assignmentRow } = await admin
          .from("pm_schedule_assignments")
          .select("organization_id, property_id")
          .eq("id", createJson.assignment.id)
          .maybeSingle();
        failures +=
          assignmentRow?.organization_id === activeOrg &&
          assignmentRow?.property_id === activeProp
            ? pass("Created pm_schedule_assignment auto-stamped via trigger")
            : fail("Created pm_schedule_assignment auto-stamped via trigger");

        // --- Occurrence resolve/create ---
        const occRes = await fetch(`${BASE}/api/maintenance/pm-occurrences`, {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ assignment_id: createJson.assignment.id }),
        });
        const occJson = await occRes.json();
        if (occRes.status === 200 && occJson.occurrence?.id) {
          createdOccurrenceId = occJson.occurrence.id;
          const { data: occurrenceRow } = await admin
            .from("pm_occurrences")
            .select("organization_id, property_id")
            .eq("id", createdOccurrenceId)
            .maybeSingle();
          failures +=
            occurrenceRow?.organization_id === activeOrg &&
            occurrenceRow?.property_id === activeProp
              ? pass("Created pm_occurrence stamped with active org/property")
              : fail("Created pm_occurrence stamped with active org/property");

          const detailRes = await fetch(
            `${BASE}/api/maintenance/pm-occurrences/${createdOccurrenceId}`,
            { headers: authHeaders }
          );
          failures +=
            detailRes.status === 200
              ? pass("GET pm_occurrence detail returns 200")
              : fail("GET pm_occurrence detail returns 200", `HTTP ${detailRes.status}`);

          const patchRes = await fetch(
            `${BASE}/api/maintenance/pm-occurrences/${createdOccurrenceId}`,
            {
              method: "PATCH",
              headers: jsonHeaders,
              body: JSON.stringify({ session_notes: "checkpoint sc5 verification" }),
            }
          );
          failures +=
            patchRes.status === 200
              ? pass("PATCH pm_occurrence within tenant returns 200")
              : fail("PATCH pm_occurrence within tenant returns 200", `HTTP ${patchRes.status}`);
        } else {
          failures += fail(
            "Resolve pm_occurrence for new assignment",
            occJson.error || `HTTP ${occRes.status}`
          );
        }
      }
    } else {
      failures += fail("Create pm_template", createJson.error || `HTTP ${createRes.status}`);
    }
  }

  // --- Cross-property fail-closed ---
  const { data: otherProps } = await admin
    .from("properties")
    .select("id")
    .not("id", "in", `(${[...assignedIds].join(",") || "0"})`)
    .limit(1);
  const foreignId = otherProps?.[0]?.id;
  if (foreignId) {
    const forbidden = await fetch(`${BASE}/api/pm-templates`, {
      headers: { ...authHeaders, "x-one-eyrie-property-id": String(foreignId) },
    });
    failures +=
      forbidden.status === 403
        ? pass(`Unauthorized property id ${foreignId} returns 403`)
        : fail(`Unauthorized property id ${foreignId} returns 403`, `got ${forbidden.status}`);
  } else {
    pass("No foreign property available — cross-property 403 check skipped");
  }

  // --- Cleanup ---
  if (createdTemplateId) {
    const delRes = await fetch(`${BASE}/api/pm-templates/${createdTemplateId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    failures +=
      delRes.status === 200
        ? pass("Delete test pm_template returns 200")
        : fail("Delete test pm_template returns 200", `HTTP ${delRes.status}`);
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

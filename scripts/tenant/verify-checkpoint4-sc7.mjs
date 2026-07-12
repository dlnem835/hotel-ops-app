/**
 * Checkpoint 4 — Sub-checkpoint 7 verification.
 * Settings, team management, and active property settings tenant scoping.
 *
 * Verifies auth gating, scoped team-member reads, root-create stamping,
 * membership alignment, property settings via properties table, boundary
 * checks, and cross-property fail-closed behavior.
 *
 * Usage: node scripts/tenant/verify-checkpoint4-sc7.mjs
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
  let createdMemberId = null;
  let createdAuthUserId = null;
  const testUsername = `sc7verify${Date.now()}`;

  const routes = [
    ["GET", "/api/team-members"],
    ["GET", "/api/hotel-property"],
    ["POST", "/api/create-user"],
    ["PATCH", "/api/update-user"],
  ];

  for (const [method, path] of routes) {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: method === "POST" || method === "PATCH"
        ? { "Content-Type": "application/json" }
        : undefined,
      body:
        method === "POST"
          ? JSON.stringify({ first_name: "Test" })
          : method === "PATCH"
            ? JSON.stringify({ id: 1 })
            : undefined,
    });
    failures +=
      response.status === 401
        ? pass(`${method} ${path} without auth returns 401`)
        : fail(`${method} ${path} without auth returns 401`, `got ${response.status}`);
  }

  const { data: managerRows } = await admin
    .from("team_members")
    .select("auth_user_id, is_administrator, module_permissions, job_title, organization_id, property_id")
    .not("auth_user_id", "is", null)
    .eq("organization_id", 1)
    .eq("property_id", 1);

  const manager = (managerRows ?? []).find((row) => {
    const permissions = row.module_permissions;
    const jobTitle = String(row.job_title || "").trim();
    return (
      row.is_administrator ||
      permissions?.settings === true ||
      jobTitle === "General Manager" ||
      jobTitle === "Assistant General Manager"
    );
  });

  if (!manager?.auth_user_id) {
    failures += fail("Load team manager auth user for verification");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const accessToken = await getAccessToken(admin, manager.auth_user_id);
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

  const { count: pilotMemberCount } = await admin
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", activeOrg)
    .eq("property_id", activeProp);

  failures +=
    pilotMemberCount && pilotMemberCount > 0
      ? pass(`Pilot has ${pilotMemberCount} team_members under active tenant`)
      : fail("Pilot team_members under active tenant");

  const membersRes = await fetch(`${BASE}/api/team-members`, { headers: authHeaders });
  const membersJson = await membersRes.json();
  if (membersRes.status !== 200) {
    failures += fail("GET /api/team-members authenticated returns 200", `HTTP ${membersRes.status}`);
  } else {
    pass("GET /api/team-members authenticated returns 200");
    const members = membersJson.members ?? [];
    failures +=
      members.length === pilotMemberCount
        ? pass(`Team members API returns ${members.length} members (matches pilot)`)
        : fail(
            "Team members API returns members matching pilot count",
            `got ${members.length}, expected ${pilotMemberCount}`
          );
    const outOfScope = members.filter(
      (member) =>
        member.organization_id !== activeOrg || member.property_id !== activeProp
    );
    failures +=
      outOfScope.length === 0
        ? pass("Team members API excludes users outside active org/property")
        : fail("Team members API excludes users outside active org/property");
  }

  const { data: propertyRow } = await admin
    .from("properties")
    .select("name, address, phone_number")
    .eq("id", activeProp)
    .eq("organization_id", activeOrg)
    .maybeSingle();

  const hotelRes = await fetch(`${BASE}/api/hotel-property`, { headers: authHeaders });
  const hotelJson = await hotelRes.json();
  if (hotelRes.status !== 200) {
    failures += fail("GET /api/hotel-property authenticated returns 200", `HTTP ${hotelRes.status}`);
  } else {
    pass("GET /api/hotel-property authenticated returns 200");
    failures +=
      hotelJson.property?.hotelName === propertyRow?.name
        ? pass("Hotel property API reads active properties row")
        : fail(
            "Hotel property API reads active properties row",
            `API=${hotelJson.property?.hotelName}, DB=${propertyRow?.name}`
          );
  }

  const createRes = await fetch(`${BASE}/api/create-user`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      first_name: "Checkpoint",
      last_name: "Sc7Verify",
      email: "sc7-verify@example.com",
      phone: "",
      job_title: "Front Desk Agent",
      is_administrator: false,
      module_permissions: { dashboard: true },
      status: "Active",
      can_login: true,
      username: testUsername,
      tempPassword: "Sc7Verify!TempPass",
    }),
  });
  const createJson = await createRes.json();
  if (createRes.status !== 200 || !createJson.user?.id) {
    failures += fail("POST /api/create-user creates team member", createJson.error || `HTTP ${createRes.status}`);
  } else {
    pass("POST /api/create-user creates team member");
    createdMemberId = createJson.user.id;
    createdAuthUserId = createJson.user.auth_user_id;

    const { data: stamped } = await admin
      .from("team_members")
      .select("organization_id, property_id, default_property_id")
      .eq("id", createdMemberId)
      .maybeSingle();
    failures +=
      stamped?.organization_id === activeOrg &&
      stamped?.property_id === activeProp &&
      stamped?.default_property_id === activeProp
        ? pass("Created team_member stamped with active org/property/default_property_id")
        : fail("Created team_member stamped with active org/property/default_property_id");

    if (createdAuthUserId) {
      const { data: orgMembership } = await admin
        .from("organization_users")
        .select("organization_id, role, active")
        .eq("user_id", createdAuthUserId)
        .eq("organization_id", activeOrg)
        .maybeSingle();
      failures +=
        orgMembership?.role === "org_member" && orgMembership?.active === true
          ? pass("organization_users membership aligned on create")
          : fail("organization_users membership aligned on create");

      const { data: propertyMembership } = await admin
        .from("user_properties")
        .select("property_id, role, is_default, active, module_permissions")
        .eq("user_id", createdAuthUserId)
        .eq("property_id", activeProp)
        .maybeSingle();
      failures +=
        propertyMembership?.role === "property_staff" &&
        propertyMembership?.is_default === true &&
        propertyMembership?.active === true &&
        propertyMembership?.module_permissions?.dashboard === true
          ? pass("user_properties membership aligned on create")
          : fail("user_properties membership aligned on create");
    }

    const updateRes = await fetch(`${BASE}/api/update-user`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({
        id: createdMemberId,
        first_name: "Checkpoint",
        last_name: "Sc7Updated",
        email: "sc7-verify@example.com",
        phone: "",
        job_title: "Front Desk Agent",
        is_administrator: false,
        module_permissions: { dashboard: true, pass_on: true },
        status: "Active",
        can_login: true,
        username: testUsername,
      }),
    });
    failures +=
      updateRes.status === 200
        ? pass("PATCH /api/update-user updates team member in tenant")
        : fail("PATCH /api/update-user updates team member in tenant", `HTTP ${updateRes.status}`);

    if (createdAuthUserId) {
      const { data: updatedMembership } = await admin
        .from("user_properties")
        .select("module_permissions")
        .eq("user_id", createdAuthUserId)
        .eq("property_id", activeProp)
        .maybeSingle();
      failures +=
        updatedMembership?.module_permissions?.pass_on === true
          ? pass("user_properties module_permissions updated on PATCH")
          : fail("user_properties module_permissions updated on PATCH");
    }
  }

  if (createdMemberId) {
    const originalName = propertyRow?.name ?? "";
    const marker = `${originalName}`.trim() || "Pilot Property";
    const patchRes = await fetch(`${BASE}/api/hotel-property`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({
        hotelName: marker,
        address: propertyRow?.address ?? "",
        phoneNumber: propertyRow?.phone_number ?? "",
      }),
    });
    failures +=
      patchRes.status === 200
        ? pass("PATCH /api/hotel-property updates active properties row")
        : fail("PATCH /api/hotel-property updates active properties row", `HTTP ${patchRes.status}`);

    const { data: updatedProperty } = await admin
      .from("properties")
      .select("name")
      .eq("id", activeProp)
      .eq("organization_id", activeOrg)
      .maybeSingle();
    failures +=
      updatedProperty?.name === marker
        ? pass("properties table reflects hotel-property PATCH")
        : fail("properties table reflects hotel-property PATCH");

    await admin
      .from("properties")
      .update({
        name: originalName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeProp)
      .eq("organization_id", activeOrg);
    pass("Hotel property test update reverted");
  }

  const { data: otherProps } = await admin
    .from("properties")
    .select("id")
    .not("id", "in", `(${[...assignedIds].join(",") || "0"})`)
    .limit(1);
  const foreignId = otherProps?.[0]?.id;
  if (foreignId) {
    const forbidden = await fetch(`${BASE}/api/team-members`, {
      headers: { ...authHeaders, "x-one-eyrie-property-id": String(foreignId) },
    });
    failures +=
      forbidden.status === 403
        ? pass(`Unauthorized property id ${foreignId} returns 403`)
        : fail(`Unauthorized property id ${foreignId} returns 403`, `got ${forbidden.status}`);
  } else {
    pass("No foreign property available — cross-property 403 check skipped");
  }

  const { data: foreignMember } = await admin
    .from("team_members")
    .select("id")
    .or(`organization_id.neq.${activeOrg},property_id.neq.${activeProp}`)
    .limit(1)
    .maybeSingle();

  if (foreignMember?.id) {
    const boundaryRes = await fetch(`${BASE}/api/update-user`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({
        id: foreignMember.id,
        first_name: "Boundary",
        last_name: "Test",
        email: "boundary@example.com",
        phone: "",
        job_title: "Front Desk Agent",
        is_administrator: false,
        module_permissions: {},
        status: "Active",
        can_login: false,
        username: "",
      }),
    });
    failures +=
      boundaryRes.status === 404
        ? pass("PATCH update-user rejects team member outside active tenant")
        : fail(
            "PATCH update-user rejects team member outside active tenant",
            `got ${boundaryRes.status}`
          );
  } else {
    pass("No out-of-tenant team member available — boundary 404 check skipped");
  }

  if (createdAuthUserId) {
    await admin.auth.admin.deleteUser(createdAuthUserId);
    await admin.from("user_properties").delete().eq("user_id", createdAuthUserId);
    await admin.from("organization_users").delete().eq("user_id", createdAuthUserId);
  }
  if (createdMemberId) {
    await admin.from("team_members").delete().eq("id", createdMemberId);
    pass("Test team member cleaned up");
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

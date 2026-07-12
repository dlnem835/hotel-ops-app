/**
 * Checkpoint 4 — Sub-checkpoint 3 verification.
 * Pass-On Log tenant scoping (desktop + mobile via authenticated APIs).
 *
 * Verifies auth gating, scoped reads, root-create stamping (pass_on_log),
 * child stamping via triggers (replies/views), edit/delete boundary behavior,
 * and cross-property fail-closed.
 *
 * Usage: node scripts/tenant/verify-checkpoint4-sc3.mjs
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
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
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
  let createdEntryId = null;

  const noAuth = await fetch(`${BASE}/api/pass-on`);
  failures +=
    noAuth.status === 401
      ? pass("GET /api/pass-on without auth returns 401")
      : fail("GET /api/pass-on without auth returns 401", `got ${noAuth.status}`);

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

  // Scoped list
  const listRes = await fetch(`${BASE}/api/pass-on`, { headers: authHeaders });
  if (listRes.status !== 200) {
    failures += fail("GET /api/pass-on authenticated returns 200", `HTTP ${listRes.status}`);
  } else {
    pass("GET /api/pass-on authenticated returns 200");
    const { entries } = await listRes.json();
    const allScoped = (entries ?? []).every(
      (e) => e.organization_id === activeOrg && e.property_id === activeProp
    );
    failures += allScoped
      ? pass(`All ${entries.length} pass-on entries scoped to active property`)
      : fail("All pass-on entries scoped to active property");
  }

  // Create entry (root, stamped)
  const today = new Date().toISOString().slice(0, 10);
  const createRes = await fetch(`${BASE}/api/pass-on`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      subject: `ZZ-CKPT4-SC3-${Date.now()}`,
      author: "verification",
      priority: "Normal",
      message: "Automated checkpoint 4 sc3 verification. Safe to delete.",
      entry_date: today,
      created_at: new Date().toISOString(),
    }),
  });
  const createJson = await createRes.json();
  if (createRes.status === 200 && createJson.entry?.id) {
    createdEntryId = createJson.entry.id;
    const stamped =
      createJson.entry.organization_id === activeOrg &&
      createJson.entry.property_id === activeProp;
    failures += stamped
      ? pass("Created pass-on entry stamped with active org/property")
      : fail("Created pass-on entry stamped with active org/property");
  } else {
    failures += fail("Create pass-on entry", createJson.error || `HTTP ${createRes.status}`);
  }

  if (createdEntryId) {
    // Add reply (child stamped by trigger)
    const replyRes = await fetch(`${BASE}/api/pass-on/${createdEntryId}/replies`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ reply_author: "verification", reply_message: "reply test" }),
    });
    const replyJson = await replyRes.json();
    if (replyRes.status === 200 && replyJson.reply?.id) {
      const { data: replyRow } = await admin
        .from("pass_on_log_replies")
        .select("organization_id, property_id")
        .eq("id", replyJson.reply.id)
        .maybeSingle();
      const stamped =
        replyRow?.organization_id === activeOrg && replyRow?.property_id === activeProp;
      failures += stamped
        ? pass("Reply auto-stamped with tenant via trigger")
        : fail("Reply auto-stamped with tenant via trigger");
    } else {
      failures += fail("Add pass-on reply", replyJson.error || `HTTP ${replyRes.status}`);
    }

    // Mark viewed
    const viewRes = await fetch(`${BASE}/api/pass-on/${createdEntryId}/views`, {
      method: "POST",
      headers: authHeaders,
    });
    failures +=
      viewRes.status === 200
        ? pass("Mark viewed returns 200")
        : fail("Mark viewed returns 200", `HTTP ${viewRes.status}`);

    // Edit entry
    const editRes = await fetch(`${BASE}/api/pass-on/${createdEntryId}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ message: "edited message" }),
    });
    const editJson = await editRes.json();
    failures +=
      editRes.status === 200 && editJson.entry?.edited_at
        ? pass("Edit pass-on entry sets edited_at")
        : fail("Edit pass-on entry sets edited_at", editJson.error || `HTTP ${editRes.status}`);

    // Delete entry
    const delRes = await fetch(`${BASE}/api/pass-on/${createdEntryId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (delRes.status === 200) {
      const { data: gone } = await admin
        .from("pass_on_log")
        .select("id")
        .eq("id", createdEntryId)
        .maybeSingle();
      failures += !gone
        ? pass("Delete pass-on entry removes row")
        : fail("Delete pass-on entry removes row");
      createdEntryId = gone ? createdEntryId : null;
    } else {
      failures += fail("Delete pass-on entry", `HTTP ${delRes.status}`);
    }
  }

  // Cross-property fail-closed
  const { data: otherProps } = await admin
    .from("properties")
    .select("id")
    .not("id", "in", `(${[...assignedIds].join(",") || "0"})`)
    .limit(1);
  const foreignId = otherProps?.[0]?.id;
  if (foreignId) {
    const forbidden = await fetch(`${BASE}/api/pass-on`, {
      headers: { ...authHeaders, "x-one-eyrie-property-id": String(foreignId) },
    });
    failures +=
      forbidden.status === 403
        ? pass(`Unauthorized property id ${foreignId} returns 403`)
        : fail(`Unauthorized property id ${foreignId} returns 403`, `got ${forbidden.status}`);
  } else {
    pass("No foreign property available — cross-property 403 check skipped");
  }

  // Best-effort cleanup if delete failed
  if (createdEntryId) {
    await admin.from("pass_on_log").delete().eq("id", createdEntryId);
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

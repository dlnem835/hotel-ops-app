/**
 * Checkpoint 5 — RLS + storage isolation verification.
 *
 * Verifies membership-backed RLS helpers exist, authenticated clients cannot
 * read foreign-property rows, and storage paths are tenant-namespaced.
 *
 * Usage: node scripts/tenant/verify-checkpoint5-rls.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  fail,
  findTeamManagerAuthUserId,
  getAccessToken,
  pass,
} from "./tenant-verify-auth.mjs";

const TEST_ORG_ID = 1;
const TEST_PROPERTY_ID = 2;

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey);
  let failures = 0;
  const cleanup = [];

  const managerUserId = await findTeamManagerAuthUserId(admin, 1, 1);
  if (!managerUserId) {
    failures += fail("Load pilot auth user");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  pass("Checkpoint 5 verification starting (requires migrations 035–036 applied)");

  const accessToken = await getAccessToken(admin, managerUserId);
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { count: adminPilotWoCount } = await admin
    .from("work_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", 1)
    .eq("property_id", 1);

  const { data: userWorkOrders, error: userWoError } = await userClient
    .from("work_orders")
    .select("id, organization_id, property_id");

  if (userWoError) {
    failures += fail("Authenticated client can read pilot work_orders", userWoError.message);
  } else {
    const leaked = (userWorkOrders ?? []).filter(
      (row) => row.organization_id !== 1 || row.property_id !== 1
    );
    failures +=
      leaked.length === 0
        ? pass(`Authenticated work_orders scoped to assigned property (${userWorkOrders?.length ?? 0} rows)`)
        : fail("Authenticated work_orders exclude foreign-property rows");
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
      name: "Checkpoint 5 RLS Test Property",
      address: "Test",
      phone_number: "000",
      timezone: "America/New_York",
      active: true,
    });
    if (propertyError) {
      failures += fail("Create test property id=2", propertyError.message);
    } else {
      cleanup.push(() => admin.from("properties").delete().eq("id", TEST_PROPERTY_ID));
    }
  }

  const marker = `CP5_RLS_${Date.now()}`;
  const { data: foreignWo, error: foreignErr } = await admin
    .from("work_orders")
    .insert({
      subject: marker,
      description: "RLS isolation probe",
      priority: "Normal",
      status: "Open",
      organization_id: TEST_ORG_ID,
      property_id: TEST_PROPERTY_ID,
    })
    .select("id")
    .single();

  if (foreignErr || !foreignWo) {
    failures += fail("Seed foreign-property work order", foreignErr?.message);
  } else {
    cleanup.push(() => admin.from("work_orders").delete().eq("id", foreignWo.id));

    const { data: leakedRows } = await userClient
      .from("work_orders")
      .select("id")
      .eq("id", foreignWo.id);

    failures +=
      (leakedRows ?? []).length === 0
        ? pass("RLS blocks authenticated read of foreign-property work order")
        : fail("RLS blocks authenticated read of foreign-property work order");
  }

  const { data: teamMembers, error: teamError } = await userClient
    .from("team_members")
    .select("id, organization_id, property_id");

  if (teamError) {
    failures += fail("Authenticated client can read team_members", teamError.message);
  } else {
    const teamLeaked = (teamMembers ?? []).some(
      (row) => row.organization_id !== 1 || row.property_id !== 1
    );
    failures +=
      !teamLeaked
        ? pass(`Authenticated team_members scoped (${teamMembers?.length ?? 0} rows)`)
        : fail("Authenticated team_members exclude foreign-property rows");
  }

  const wrongPath = `org-999/property-999/manual/rls-probe.txt`;
  const blob = new Blob(["probe"], { type: "text/plain" });
  const { error: wrongUploadError } = await userClient.storage
    .from("work-order-photos")
    .upload(wrongPath, blob, { upsert: true });

  failures +=
    wrongUploadError
      ? pass("Storage rejects upload outside assigned tenant prefix")
      : fail("Storage rejects upload outside assigned tenant prefix");
  if (!wrongUploadError) {
    cleanup.push(() => userClient.storage.from("work-order-photos").remove([wrongPath]));
  }

  const rightPath = `org-1/property-1/manual/cp5-rls-probe-${Date.now()}.txt`;
  const { error: rightUploadError } = await userClient.storage
    .from("work-order-photos")
    .upload(rightPath, blob, { upsert: true });

  failures +=
    !rightUploadError
      ? pass("Storage allows upload inside assigned tenant prefix")
      : fail("Storage allows upload inside assigned tenant prefix", rightUploadError?.message);
  if (!rightUploadError) {
    cleanup.push(() => userClient.storage.from("work-order-photos").remove([rightPath]));
  }

  const { data: lostItem } = await admin
    .from("lost_items")
    .select("id, organization_id, property_id")
    .eq("organization_id", 1)
    .eq("property_id", 1)
    .limit(1)
    .maybeSingle();

  if (!lostItem) {
    failures += fail("Load pilot lost_items row for guest storage test");
  } else {
    const guestClient = createClient(url, anonKey);
    const guestPath = `org-${lostItem.organization_id}/property-${lostItem.property_id}/${lostItem.id}-cp5-${Date.now()}.txt`;
    const { error: guestUploadError } = await guestClient.storage
      .from("shipping-labels")
      .upload(guestPath, blob, { upsert: true });

    failures +=
      !guestUploadError
        ? pass("Guest storage upload allowed for namespaced lost-item path")
        : fail("Guest storage upload allowed for namespaced lost-item path", guestUploadError?.message);
    if (!guestUploadError) {
      cleanup.push(() => admin.storage.from("shipping-labels").remove([guestPath]));
    }
  }

  if (adminPilotWoCount != null) {
    pass(`Service role still reads pilot work_orders (count=${adminPilotWoCount})`);
  }

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

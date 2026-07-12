/**
 * Platform admin portal — Stage A verification.
 *
 * Verifies migrations 037–040: schema, RLS, properties_id_seq, pilot module backfill.
 * Optional: platform owner seeded (041) enables platform-admin RLS read tests.
 *
 * Usage: node scripts/tenant/verify-platform-admin-stage-a.mjs
 */

import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  fail,
  findTeamManagerAuthUserId,
  getAccessToken,
  pass,
} from "./tenant-verify-auth.mjs";

const ALL_MODULE_KEYS = [
  "dashboard",
  "reports",
  "lost_found",
  "pass_on",
  "inspections",
  "maintenance",
  "settings",
];

function resolveDatabaseUrl() {
  loadEnvLocal();
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const password = process.env.SUPABASE_DB_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (password && match) {
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${match[1]}.supabase.co:5432/postgres`;
  }

  return null;
}

async function verifyPropertyIdSequence(maxPropertyId, failures) {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    pass(
      `Property max id=${maxPropertyId} — set SUPABASE_DB_PASSWORD to verify properties_id_seq`
    );
    return failures;
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT last_value::bigint AS last_value, is_called FROM properties_id_seq"
    );
    const row = rows[0];
    if (!row) {
      failures += fail("properties_id_seq exists");
      return failures;
    }

    const expectedNext = row.is_called ? Number(row.last_value) + 1 : Number(row.last_value);
    failures +=
      expectedNext > maxPropertyId
        ? pass(
            `properties_id_seq next id will be ${expectedNext} (max property id=${maxPropertyId})`
          )
        : fail(
            "properties_id_seq",
            `expected next > ${maxPropertyId}, got ${expectedNext}`
          );
  } catch (error) {
    failures += fail(
      "properties_id_seq",
      error instanceof Error ? error.message : "query failed"
    );
  } finally {
    await client.end();
  }

  return failures;
}

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

  pass("Stage A verification starting (requires migrations 037–040 applied)");

  const tables = [
    "platform_admins",
    "organization_modules",
    "organization_invitations",
    "admin_audit_log",
  ];

  for (const table of tables) {
    const { error } = await admin.from(table).select("id").limit(1);
    failures +=
      !error
        ? pass(`Table ${table} exists`)
        : fail(`Table ${table} exists`, error.message);
  }

  if (failures > 0) {
    console.log(
      "\nApply migrations 037–040 in Supabase SQL editor, then re-run this script."
    );
    console.log(`Failures: ${failures}`);
    process.exit(1);
  }

  const { data: pilotModules, error: modulesError } = await admin
    .from("organization_modules")
    .select("module_key, enabled")
    .eq("organization_id", 1);

  if (modulesError) {
    failures += fail("Pilot org module backfill", modulesError.message);
  } else {
    const keys = new Set((pilotModules ?? []).map((row) => row.module_key));
    const allEnabled = ALL_MODULE_KEYS.every(
      (key) => keys.has(key) && pilotModules?.find((r) => r.module_key === key)?.enabled
    );
    failures +=
      allEnabled
        ? pass(`Pilot org has all ${ALL_MODULE_KEYS.length} modules enabled`)
        : fail("Pilot org has all modules enabled");
  }

  const { data: maxPropertyRow } = await admin
    .from("properties")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const maxPropertyId = maxPropertyRow?.id ?? 0;
  failures = await verifyPropertyIdSequence(maxPropertyId, failures);

  const managerUserId = await findTeamManagerAuthUserId(admin, 1, 1);
  if (!managerUserId) {
    failures += fail("Load pilot hotel user for RLS negative tests");
  } else {
    const hotelToken = await getAccessToken(admin, managerUserId);
    const hotelClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${hotelToken}` } },
    });

    const { data: hotelPlatformAdmins, error: hotelPaError } = await hotelClient
      .from("platform_admins")
      .select("id");

    failures +=
      !hotelPaError && (hotelPlatformAdmins ?? []).length === 0
        ? pass("Hotel user cannot read platform_admins via RLS")
        : fail("Hotel user cannot read platform_admins via RLS");

    const { data: hotelModules, error: hotelModError } = await hotelClient
      .from("organization_modules")
      .select("id")
      .eq("organization_id", 1);

    failures +=
      !hotelModError && (hotelModules ?? []).length === 0
        ? pass("Hotel user cannot read organization_modules via RLS")
        : fail("Hotel user cannot read organization_modules via RLS");

    const { data: hotelAudit, error: hotelAuditError } = await hotelClient
      .from("admin_audit_log")
      .select("id");

    failures +=
      !hotelAuditError && (hotelAudit ?? []).length === 0
        ? pass("Hotel user cannot read admin_audit_log via RLS")
        : fail("Hotel user cannot read admin_audit_log via RLS");
  }

  const { data: platformAdmins, error: paListError } = await admin
    .from("platform_admins")
    .select("user_id, role, active")
    .eq("active", true);

  if (paListError) {
    failures += fail("Load platform_admins", paListError.message);
  } else if ((platformAdmins ?? []).length === 0) {
    pass(
      "No platform owner seeded yet — apply 041_platform_owner_seed.sql INSERT manually"
    );
  } else {
    const owner = platformAdmins.find((row) => row.role === "platform_owner") ?? platformAdmins[0];
    const platformToken = await getAccessToken(admin, owner.user_id);
    const platformClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${platformToken}` } },
    });

    const { data: ownRows, error: ownError } = await platformClient
      .from("platform_admins")
      .select("user_id, role")
      .eq("user_id", owner.user_id);

    failures +=
      !ownError && (ownRows ?? []).length >= 1
        ? pass("Platform admin can read platform_admins via RLS")
        : fail("Platform admin can read platform_admins via RLS", ownError?.message);

    const { data: orgModules, error: orgModError } = await platformClient
      .from("organization_modules")
      .select("module_key")
      .eq("organization_id", 1);

    failures +=
      !orgModError && (orgModules ?? []).length >= ALL_MODULE_KEYS.length
        ? pass("Platform admin can read organization_modules via RLS")
        : fail("Platform admin can read organization_modules via RLS", orgModError?.message);
  }

  console.log(`\nFailures: ${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

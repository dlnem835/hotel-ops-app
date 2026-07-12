/**
 * Verify migration 026 using Supabase service role only (no direct Postgres).
 *
 * Usage:
 *   node scripts/tenant/verify-migration-026.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

const BASELINE_PATH = path.join(
  process.cwd(),
  "scripts/tenant/snapshots/row-counts-checkpoint1-before.json"
);

const OPERATIONAL_TABLES = [
  "team_members",
  "pass_on_log",
  "pass_on_log_replies",
  "pass_on_log_views",
  "lost_items",
  "hotel_property",
  "buildings_and_areas",
  "work_orders",
  "pm_occurrences",
  "inspection_sessions",
  "scheduled_report_schedules",
];

function norm(value) {
  return (value ?? "").toString().trim();
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const report = {
    capturedAt: new Date().toISOString(),
    migration: "026",
    checks: {},
    passed: true,
  };

  function fail(check, message) {
    report.checks[check] = { ok: false, message };
    report.passed = false;
    console.log(`FAIL  ${check}: ${message}`);
  }

  function pass(check, message, details = null) {
    report.checks[check] = { ok: true, message, details };
    console.log(`OK    ${check}: ${message}`);
  }

  console.log("=== Migration 026 verification (service role) ===\n");

  // organizations
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (orgError) {
    fail("organizations_table", orgError.message);
  } else if (!org) {
    fail("organizations_table", "No row with id=1");
  } else if (org.slug !== "one-eyrie-pilot" || org.status !== "active") {
    fail("organizations_table", `Unexpected org row: ${JSON.stringify(org)}`);
  } else {
    pass("organizations_table", `id=1, slug=${org.slug}, name=${org.name}`, org);
  }

  // properties
  const { data: prop, error: propError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (propError) {
    fail("properties_table", propError.message);
  } else if (!prop) {
    fail("properties_table", "No row with id=1");
  } else if (prop.organization_id !== 1) {
    fail("properties_table", `organization_id expected 1, got ${prop.organization_id}`);
  } else {
    pass("properties_table", `id=1, org=${prop.organization_id}, name=${prop.name}`, prop);
  }

  // hotel_property unchanged
  const { data: hp, error: hpError } = await supabase
    .from("hotel_property")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (hpError) {
    fail("hotel_property_unchanged", hpError.message);
  } else if (!hp) {
    fail("hotel_property_unchanged", "hotel_property id=1 missing");
  } else {
    pass("hotel_property_unchanged", "hotel_property id=1 still present", hp);
  }

  // pilot copy parity
  if (prop && hp) {
    const nameOk =
      norm(prop.name) === norm(hp.hotel_name) ||
      (norm(hp.hotel_name) === "" && norm(prop.name).length > 0);
    const addressOk = norm(prop.address) === norm(hp.address);
    const phoneOk = norm(prop.phone_number) === norm(hp.phone_number);

    if (nameOk && addressOk && phoneOk) {
      pass("pilot_property_copy", "properties id=1 matches hotel_property fields", {
        legacy_hotel_name: hp.hotel_name,
        properties_name: prop.name,
        address: prop.address,
        phone_number: prop.phone_number,
      });
    } else {
      fail("pilot_property_copy", "Field mismatch between properties and hotel_property", {
        nameOk,
        addressOk,
        phoneOk,
        hotel_property: hp,
        properties: prop,
      });
    }
  }

  // operational row counts
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const rowCounts = {};
  let countsOk = true;

  for (const table of OPERATIONAL_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    const expected = baseline.tables[table]?.count ?? null;
    const actual = error ? null : (count ?? 0);
    const ok = !error && actual === expected;
    if (!ok) countsOk = false;

    rowCounts[table] = { expected, actual, ok, error: error?.message ?? null };
    console.log(
      `${ok ? "OK" : "FAIL"}  row_count ${table}: ${actual} (baseline ${expected})`
    );
  }

  if (countsOk) {
    pass("operational_row_counts", "All operational table counts match baseline", rowCounts);
  } else {
    fail("operational_row_counts", "One or more counts differ from baseline", rowCounts);
  }

  const outPath = path.join(
    process.cwd(),
    "scripts/tenant/snapshots/row-counts-after-026.json"
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify({ ...report, rowCounts }, null, 2),
    "utf8"
  );

  console.log(`\nWrote ${outPath}`);
  console.log(`\nOverall: ${report.passed ? "PASSED" : "FAILED"}`);

  if (!report.passed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

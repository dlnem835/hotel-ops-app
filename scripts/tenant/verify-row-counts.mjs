/**
 * Checkpoint 1/2 — capture row counts before and after tenant migrations.
 *
 * Usage:
 *   node scripts/tenant/verify-row-counts.mjs
 *   node scripts/tenant/verify-row-counts.mjs --out reports/tenant-row-counts-before.json
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

const TENANT_TABLES = [
  "organizations",
  "properties",
  "organization_users",
  "user_properties",
  "hotel_property",
  "team_members",
  "buildings_and_areas",
  "property_inspection_templates",
  "inspection_settings",
  "inspection_sessions",
  "inspection_item_responses",
  "inspection_deficiencies",
  "area_inspection_summary",
  "pm_templates",
  "pm_schedule_assignments",
  "pm_occurrences",
  "work_orders",
  "pass_on_log",
  "pass_on_log_replies",
  "pass_on_log_views",
  "lost_items",
  "scheduled_report_schedules",
  "scheduled_report_runs",
];

const PRE_MIGRATION_TABLES = [
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

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const tables = process.argv.includes("--all") ? TENANT_TABLES : PRE_MIGRATION_TABLES;
  const outArgIndex = process.argv.indexOf("--out");
  const outPath =
    outArgIndex >= 0 ? process.argv[outArgIndex + 1] : null;

  const snapshot = {
    capturedAt: new Date().toISOString(),
    projectUrl: url,
    tables: {},
  };

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    snapshot.tables[table] = error
      ? { error: error.message, count: null }
      : { count: count ?? 0 };
  }

  const json = JSON.stringify(snapshot, null, 2);
  if (outPath) {
    const absolute = path.resolve(outPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, json, "utf8");
    console.log(`Wrote ${absolute}`);
  } else {
    console.log(json);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

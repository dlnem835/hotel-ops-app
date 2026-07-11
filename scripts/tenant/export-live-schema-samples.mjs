/**
 * Live column inventory from sample rows (Checkpoint 1 baseline).
 * Complements OpenAPI/Postgres exporters when exact DDL is unavailable.
 *
 * Usage:
 *   node scripts/tenant/export-live-schema-samples.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

const TABLES = [
  "team_members",
  "pass_on_log",
  "pass_on_log_replies",
  "pass_on_log_views",
  "lost_items",
];

const OUTPUT = path.join(
  process.cwd(),
  "supabase/migrations/history/000_live_baseline_pass_on_lost_items_team_members.sql"
);

function inferType(value) {
  if (value === null || value === undefined) return "unknown (null in sample)";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "numeric";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "jsonb";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return "timestamptz (inferred)";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date (inferred)";
    if (/^[0-9a-f-]{36}$/i.test(value)) return "uuid (inferred)";
    return "text";
  }
  return "text";
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env vars");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const chunks = [
    "-- Live baseline schema export (Checkpoint 1) — sample-row inventory",
    `-- Generated at: ${new Date().toISOString()}`,
    "-- Source: scripts/tenant/export-live-schema-samples.mjs",
    "--",
    "-- Columns and inferred types from live sample rows (service role read).",
    "-- For exact DDL including constraints, defaults, indexes, and RLS, run:",
    "--   node scripts/tenant/export-live-ddl.mjs",
    "-- after setting SUPABASE_DB_URL in .env.local.",
    "-- DO NOT APPLY — reference only.",
    "",
  ];

  for (const table of TABLES) {
    chunks.push(`-- ── public.${table} ──`);

    const { data, error, count } = await supabase
      .from(table)
      .select("*", { count: "exact" })
      .limit(3);

    if (error) {
      chunks.push(`-- ERROR: ${error.message}`, "");
      continue;
    }

    chunks.push(`-- live row count at export: ${count ?? 0}`);

    if (!data?.length) {
      chunks.push("-- WARNING: no sample rows returned; column list unavailable", "");
      continue;
    }

    const keys = new Set();
    for (const row of data) {
      Object.keys(row).forEach((key) => keys.add(key));
    }

    const lines = [...keys].sort().map((column) => {
      const sample = data.find((row) => row[column] !== null && row[column] !== undefined);
      const value = sample ? sample[column] : data[0][column];
      const type = inferType(value);
      return `  ${column} ${type}`;
    });

    chunks.push(`CREATE TABLE public.${table} (`);
    chunks.push(lines.join(",\n"));
    chunks.push(");", "");
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, chunks.join("\n"), "utf8");
  console.log(`Wrote ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

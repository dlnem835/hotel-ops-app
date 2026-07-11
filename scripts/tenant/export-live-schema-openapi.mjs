/**
 * Fallback live schema export via Supabase PostgREST OpenAPI when direct Postgres
 * access is unavailable.
 *
 * Usage:
 *   node scripts/tenant/export-live-schema-openapi.mjs
 */

import fs from "node:fs";
import path from "node:path";
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

function formatColumn(name, schema, required) {
  const format = schema.format || "";
  let sqlType = "text";

  if (schema.type === "integer") sqlType = "integer";
  else if (schema.type === "number") sqlType = "numeric";
  else if (schema.type === "boolean") sqlType = "boolean";
  else if (schema.type === "string") {
    if (format === "uuid") sqlType = "uuid";
    else if (format === "date") sqlType = "date";
    else if (format === "date-time") sqlType = "timestamptz";
    else sqlType = "text";
  } else if (schema.type === "object" || schema.type === "array") {
    sqlType = "jsonb";
  }

  const notNull = required.has(name) ? " NOT NULL" : "";
  const description = schema.description ? ` -- ${schema.description}` : "";
  return `  ${name} ${sqlType}${notNull}${description}`;
}

function extractTableFromPath(openApi, table) {
  const pathItem = openApi.paths?.[`/${table}`];
  if (!pathItem) return null;

  const post = pathItem.post || pathItem.patch || pathItem.get;
  const schema =
    post?.requestBody?.content?.["application/json"]?.schema ||
    post?.parameters?.find((p) => p.in === "body")?.schema;

  let properties = schema?.properties;
  let required = new Set(schema?.required || []);

  if (!properties && schema?.$ref) {
    const refName = schema.$ref.replace("#/components/schemas/", "");
    const ref = openApi.components?.schemas?.[refName];
    properties = ref?.properties;
    required = new Set(ref?.required || []);
  }

  if (!properties) {
    const get = pathItem.get;
    const responseSchema =
      get?.responses?.["200"]?.content?.["application/json"]?.schema?.items;
    if (responseSchema?.$ref) {
      const refName = responseSchema.$ref.replace("#/components/schemas/", "");
      const ref = openApi.components?.schemas?.[refName];
      properties = ref?.properties;
      required = new Set(ref?.required || []);
    } else if (responseSchema?.properties) {
      properties = responseSchema.properties;
      required = new Set(responseSchema.required || []);
    }
  }

  if (!properties) return null;
  return { properties, required };
}

async function main() {
  loadEnvLocal();

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const response = await fetch(`${baseUrl}/rest/v1/`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/openapi+json",
    },
  });

  if (!response.ok) {
    console.error(`OpenAPI fetch failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }

  const openApi = await response.json();

  const chunks = [
    "-- Live baseline schema export (Checkpoint 1) — PostgREST OpenAPI",
    `-- Generated at: ${new Date().toISOString()}`,
    "-- Source: scripts/tenant/export-live-schema-openapi.mjs",
    "--",
    "-- NOTE: Column types/nullability from PostgREST OpenAPI. For exact DDL",
    "-- (constraints, defaults, indexes, RLS), run export-live-ddl.mjs with",
    "-- SUPABASE_DB_URL after adding the database password to .env.local.",
    "-- DO NOT APPLY — reference only.",
    "",
  ];

  for (const table of TABLES) {
    chunks.push(`-- ── public.${table} ──`);

    const extracted = extractTableFromPath(openApi, table);
    if (!extracted) {
      chunks.push(`-- WARNING: could not infer columns from OpenAPI`, "");
      continue;
    }

    const lines = Object.entries(extracted.properties).map(([name, property]) =>
      formatColumn(name, property, extracted.required)
    );

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

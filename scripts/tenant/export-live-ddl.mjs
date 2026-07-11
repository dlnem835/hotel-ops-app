/**
 * Checkpoint 1 — export exact live DDL for pre-migration tables.
 *
 * Usage (requires direct Postgres access to Supabase):
 *   set SUPABASE_DB_URL=postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
 *   node scripts/tenant/export-live-ddl.mjs
 *
 * Output:
 *   supabase/migrations/history/000_live_baseline_pass_on_lost_items_team_members.sql
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";
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

const TABLE_DDL_SQL = `
SELECT
  'CREATE TABLE ' || quote_ident(n.nspname) || '.' || quote_ident(c.relname) || E' (\\n' ||
  string_agg(
    '  ' || quote_ident(a.attname) || ' ' ||
    pg_catalog.format_type(a.atttypid, a.atttypmod) ||
    CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END,
    E',\\n'
    ORDER BY a.attnum
  ) ||
  E'\\n);'
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relname = $1
  AND a.attnum > 0
  AND NOT a.attisdropped
GROUP BY n.nspname, c.relname;
`;

const INDEXES_SQL = `
SELECT indexdef || ';'
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = $1
ORDER BY indexname;
`;

const CONSTRAINTS_SQL = `
SELECT pg_get_constraintdef(c.oid) || ';'
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = $1
  AND c.contype IN ('c', 'f', 'p', 'u')
ORDER BY c.contype, c.conname;
`;

const POLICIES_SQL = `
SELECT format(
  'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
  pol.polname,
  n.nspname,
  c.relname,
  CASE pol.polpermissive WHEN true THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END,
  pg_catalog.array_to_string(pol.polroles::name[], ', '),
  CASE WHEN pol.polqual IS NOT NULL THEN ' USING (' || pg_get_expr(pol.polqual, pol.polrelid) || ')' ELSE '' END,
  CASE WHEN pol.polwithcheck IS NOT NULL THEN ' WITH CHECK (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')' ELSE '' END
)
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = $1
ORDER BY pol.polname;
`;

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

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error(
      [
        "Missing database connection.",
        "Set SUPABASE_DB_URL or DATABASE_URL, or set SUPABASE_DB_PASSWORD with NEXT_PUBLIC_SUPABASE_URL in .env.local.",
        "Find the database password in Supabase Dashboard → Project Settings → Database.",
      ].join("\n")
    );
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  const chunks = [
    "-- Live baseline DDL export (Checkpoint 1)",
    `-- Generated at: ${new Date().toISOString()}`,
    "-- Source: scripts/tenant/export-live-ddl.mjs",
    "-- DO NOT APPLY — reference only. Checkpoint 2 migrations ALTER existing tables.",
    "",
  ];

  for (const table of TABLES) {
    chunks.push(`-- ── ${table} ──`, "");

    const exists = await client.query(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [`public.${table}`]
    );
    if (!exists.rows[0]?.exists) {
      chunks.push(`-- WARNING: public.${table} not found in live database`, "");
      continue;
    }

    const ddl = await client.query(TABLE_DDL_SQL, [table]);
    if (ddl.rows[0]?.string_agg) {
      chunks.push(ddl.rows[0].string_agg, "");
    }

    const indexes = await client.query(INDEXES_SQL, [table]);
    for (const row of indexes.rows) {
      chunks.push(row.indexdef);
    }
    if (indexes.rows.length) chunks.push("");

    const constraints = await client.query(CONSTRAINTS_SQL, [table]);
    for (const row of constraints.rows) {
      chunks.push(`-- constraint: ${row.pg_get_constraintdef}`);
    }
    if (constraints.rows.length) chunks.push("");

    const rls = await client.query(
      `SELECT relrowsecurity, relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = $1`,
      [table]
    );
    if (rls.rows[0]?.relrowsecurity) {
      chunks.push(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      const policies = await client.query(POLICIES_SQL, [table]);
      for (const row of policies.rows) {
        chunks.push(row.format);
      }
      chunks.push("");
    }
  }

  await client.end();

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, chunks.join("\n"), "utf8");
  console.log(`Wrote ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

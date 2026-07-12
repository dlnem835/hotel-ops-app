/**
 * Apply a SQL migration file to Supabase Postgres when a direct connection is available.
 *
 * Usage: node scripts/tenant/apply-sql-migration.mjs supabase/migrations/035_*.sql
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { loadEnvLocal } from "./load-env-local.mjs";

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
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error("Usage: node scripts/tenant/apply-sql-migration.mjs <path-to.sql>");
    process.exit(1);
  }

  const sqlPath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration file not found: ${sqlPath}`);
    process.exit(1);
  }

  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    console.error(
      "Missing database connection. Set SUPABASE_DB_URL or SUPABASE_DB_PASSWORD in .env.local."
    );
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log(`Applied migration: ${path.basename(sqlPath)}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

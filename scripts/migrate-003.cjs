/**
 * Run migration 003 against Supabase Postgres.
 * Requires SUPABASE_DB_PASSWORD or DATABASE_URL in .env.local
 *
 * Usage: node scripts/migrate-003.cjs
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

function getConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const password = process.env.SUPABASE_DB_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);

  if (!password || !match) {
    return null;
  }

  const projectRef = match[1];
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
}

async function main() {
  loadEnvLocal();

  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error(
      "Missing database credentials. Add one of these to .env.local:\n" +
        "  SUPABASE_DB_PASSWORD=your_database_password\n" +
        "  DATABASE_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres\n\n" +
        "Find the password in Supabase Dashboard → Project Settings → Database."
    );
    process.exit(1);
  }

  const sqlPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    "003_property_inspection_templates.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Connecting to Supabase Postgres...");
  await client.connect();
  console.log("Running migration 003_property_inspection_templates.sql...");

  try {
    await client.query(sql);
    console.log("Migration completed successfully.");
  } finally {
    await client.end();
  }

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabase
    .from("property_inspection_templates")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Verification failed:", error.message);
    process.exit(1);
  }

  console.log("Verified: property_inspection_templates table is accessible.");
}

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});

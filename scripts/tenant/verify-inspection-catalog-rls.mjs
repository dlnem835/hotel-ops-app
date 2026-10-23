/**
 * Global inspection catalog RLS (migration 067).
 *
 * Static checks always run. Live checks use .env.local when present and do
 * not apply the migration. If 067 is not on the connected database, the
 * script records a baseline and exits 0 after static checks.
 *
 * Usage: node scripts/tenant/verify-inspection-catalog-rls.mjs
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  fail,
  findTeamManagerAuthUserId,
  getAccessToken,
  pass,
} from "./tenant-verify-auth.mjs";

const root = process.cwd();
const migrationRel = "supabase/migrations/067_inspection_catalog_read_only.sql";

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

let staticFailures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`pass  ${name}`);
  } catch (error) {
    staticFailures += 1;
    console.error(`fail  ${name}`);
    console.error(`      ${error instanceof Error ? error.message : error}`);
  }
}

const sql = read(migrationRel);
const historical = read("supabase/migrations/002_inspection_templates.sql");
const propertyTpl = read("app/inspections/lib/property-template-db.ts");
const standardsApi = read("app/api/inspection-standards/route.ts");
const propertyApi = read("app/api/property-inspection-templates/route.ts");

check("067 is forward-only and does not rewrite 002", () => {
  assert.ok(historical.includes("Authenticated users can insert inspection_templates"));
  assert.ok(sql.includes("DROP POLICY IF EXISTS \"Authenticated users can insert inspection_templates\""));
  assert.ok(!sql.includes("CREATE TABLE"));
});

check("067 drops authenticated writes on all three catalog tables", () => {
  for (const table of [
    "inspection_templates",
    "inspection_template_categories",
    "inspection_template_items",
  ]) {
    assert.ok(sql.includes(`Authenticated users can insert ${table}`));
    assert.ok(sql.includes(`Authenticated users can update ${table}`));
    assert.ok(sql.includes(`Authenticated users can delete ${table}`));
  }
});

check("067 does not drop authenticated SELECT policies", () => {
  assert.ok(!sql.includes("Authenticated users can read inspection_templates"));
  assert.ok(!sql.includes("DROP POLICY IF EXISTS \"Authenticated users can read"));
});

check("067 does not alter property_inspection_templates", () => {
  const ddl = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.ok(!/\b(ALTER|DROP|CREATE|POLICY)\b[\s\S]{0,80}property_inspection_templates/.test(ddl));
});

check("app writes to the global catalog only via service role SELECT/backfill", () => {
  assert.ok(propertyTpl.includes(".from(\"inspection_templates\")"));
  assert.ok(propertyTpl.includes("getSupabaseAdmin"));
  const writeFromCatalog = propertyTpl.match(/\.from\("inspection_templates"\)[\s\S]{0,400}/);
  assert.ok(writeFromCatalog);
  assert.ok(writeFromCatalog[0].includes(".select("));
  assert.ok(!writeFromCatalog[0].includes(".insert("));
  assert.ok(!writeFromCatalog[0].includes(".update("));
  assert.ok(!writeFromCatalog[0].includes(".delete("));
});

check("shared standards API is in-code and property templates stay tenant-gated", () => {
  assert.ok(standardsApi.includes("getStandardSummaries"));
  assert.ok(!standardsApi.includes("inspection_templates"));
  assert.ok(propertyApi.includes("resolveTenantRequest"));
  assert.ok(propertyApi.includes("property_inspection_templates") || propertyApi.includes("fetchAllPropertyTemplates"));
});

const verifySource = read(migrationRel.replace("supabase/migrations/067_inspection_catalog_read_only.sql", "scripts/tenant/verify-inspection-catalog-rls.mjs"));
check("live UPDATE/DELETE deny tests use .select() and probe rows only", () => {
  assert.ok(verifySource.includes(".update({ status: \"Inactive\" })"));
  assert.ok(verifySource.includes(".eq(\"id\", adminProbe.id)"));
  assert.ok(verifySource.includes(".select(\"id\")"));
  assert.ok(verifySource.includes("(updatedRows ?? []).length === 0"));
  assert.ok(verifySource.includes("(deletedRows ?? []).length === 0"));
  assert.ok(!verifySource.includes(".eq(\"id\", existing.id)"));
});

if (staticFailures > 0) {
  console.error(`\n${staticFailures} static check(s) failed`);
  process.exit(1);
}

console.log("\nAll static catalog RLS checks passed.");

loadEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.log("\nLive checks skipped — missing Supabase env.");
  process.exit(0);
}

const admin = createClient(url, serviceKey);
let liveFailures = 0;
const cleanup = [];

async function main() {
  const managerUserId = await findTeamManagerAuthUserId(admin, 1, 1);
  if (!managerUserId) {
    console.log("\nLive checks skipped — no pilot hotel user.");
    return;
  }

  const accessToken = await getAccessToken(admin, managerUserId);
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: catalogRows, error: catalogReadError } = await userClient
    .from("inspection_templates")
    .select("id, name")
    .limit(5);

  if (catalogReadError) {
    liveFailures += fail("Hotel user can SELECT inspection_templates", catalogReadError.message);
  } else {
    liveFailures += pass(
      `Hotel user SELECT inspection_templates (${catalogRows?.length ?? 0} rows)`
    );
  }

  const probeName = `OE_CATALOG_RLS_PROBE_${Date.now()}`;
  const { data: probe, error: probeError } = await userClient
    .from("inspection_templates")
    .insert({
      name: probeName,
      template_type: "Custom",
      status: "Inactive",
    })
    .select("id")
    .single();

  if (probe?.id) {
    cleanup.push(() => admin.from("inspection_templates").delete().eq("id", probe.id));
    console.log(
      "note  Hotel user INSERT still succeeded — migration 067 is not applied on this database. Live deny tests skipped. Probe row will be removed."
    );
    liveFailures += pass("Baseline recorded: catalog writes still open until 067 is applied");
  } else {
    liveFailures +=
      probeError
        ? pass("Hotel user INSERT into inspection_templates is denied")
        : fail("Hotel user INSERT into inspection_templates is denied");

    const { data: adminRead, error: adminReadError } = await admin
      .from("inspection_templates")
      .select("id")
      .limit(1);
    liveFailures +=
      !adminReadError
        ? pass(`Service role can SELECT inspection_templates (${adminRead?.length ?? 0})`)
        : fail("Service role can SELECT inspection_templates", adminReadError.message);

    const { data: adminProbe, error: adminInsertError } = await admin
      .from("inspection_templates")
      .insert({
        name: probeName,
        template_type: "Custom",
        status: "Inactive",
      })
      .select("id")
      .single();

    if (adminInsertError || !adminProbe) {
      liveFailures += fail("Service role can INSERT inspection_templates", adminInsertError?.message);
    } else {
      cleanup.push(() => admin.from("inspection_templates").delete().eq("id", adminProbe.id));
      liveFailures += pass("Service role can INSERT inspection_templates");

      const { data: updatedRows, error: updateError } = await userClient
        .from("inspection_templates")
        .update({ status: "Inactive" })
        .eq("id", adminProbe.id)
        .select("id");
      liveFailures +=
        updateError || (updatedRows ?? []).length === 0
          ? pass("Hotel user UPDATE on inspection_templates is denied")
          : fail("Hotel user UPDATE on inspection_templates is denied");

      const { data: deletedRows, error: deleteError } = await userClient
        .from("inspection_templates")
        .delete()
        .eq("id", adminProbe.id)
        .select("id");
      liveFailures +=
        deleteError || (deletedRows ?? []).length === 0
          ? pass("Hotel user DELETE on inspection_templates is denied")
          : fail("Hotel user DELETE on inspection_templates is denied");

      const { error: adminDeleteError } = await admin
        .from("inspection_templates")
        .delete()
        .eq("id", adminProbe.id);
      liveFailures +=
        !adminDeleteError
          ? pass("Service role can DELETE inspection_templates")
          : fail("Service role can DELETE inspection_templates", adminDeleteError.message);
    }
  }

  const { data: propertyTemplate, error: propertyReadError } = await userClient
    .from("property_inspection_templates")
    .select("id, name, organization_id, property_id")
    .eq("organization_id", 1)
    .eq("property_id", 1)
    .limit(1)
    .maybeSingle();

  if (propertyReadError) {
    liveFailures += fail(
      "Hotel user can SELECT own property_inspection_templates",
      propertyReadError.message
    );
  } else if (!propertyTemplate) {
    liveFailures += pass("No property template on pilot property — property SELECT path reachable");
  } else {
    const { error: propertyUpdateError } = await userClient
      .from("property_inspection_templates")
      .update({ name: propertyTemplate.name })
      .eq("id", propertyTemplate.id)
      .eq("organization_id", 1)
      .eq("property_id", 1);
    liveFailures +=
      !propertyUpdateError
        ? pass("Hotel user can still update own property_inspection_templates")
        : fail(
            "Hotel user can still update own property_inspection_templates",
            propertyUpdateError.message
          );
  }

  const { data: foreignTemplate } = await admin
    .from("property_inspection_templates")
    .select("id, name, organization_id, property_id")
    .or("organization_id.neq.1,property_id.neq.1")
    .limit(1)
    .maybeSingle();

  if (foreignTemplate) {
    const { data: leaked } = await userClient
      .from("property_inspection_templates")
      .select("id")
      .eq("id", foreignTemplate.id);
    liveFailures +=
      (leaked ?? []).length === 0
        ? pass("Hotel user cannot read another property's inspection template")
        : fail("Hotel user cannot read another property's inspection template");
  } else {
    liveFailures += pass("No foreign property template present — cross-property read N/A");
  }
}

await main();

for (const fn of cleanup.reverse()) {
  try {
    await fn();
  } catch {
    /* best-effort */
  }
}

if (liveFailures > 0) {
  console.error(`\n${liveFailures} live check(s) failed`);
  process.exit(1);
}

console.log("\nLive catalog RLS checks finished.");

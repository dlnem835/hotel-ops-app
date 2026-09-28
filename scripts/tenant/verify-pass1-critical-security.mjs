/**
 * Pass 1 critical security — report schedule tenant isolation + disabled
 * legacy /api/upload-label and POST /send-label.
 *
 * Static source assertions. Does not require a running server.
 *
 * Usage: node scripts/tenant/verify-pass1-critical-security.mjs
 */

import assert from "assert";
import fs from "fs";
import path from "path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`pass  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`fail  ${name}`);
    console.error(`      ${error instanceof Error ? error.message : error}`);
  }
}

const listCreate = read("app/api/reports/schedules/route.ts");
const remove = read("app/api/reports/schedules/[id]/route.ts");
const sendTest = read("app/api/reports/schedules/[id]/send-test/route.ts");
const cron = read("app/api/cron/scheduled-reports/route.ts");
const db = read("app/reports/lib/report-schedule-db.ts");
const storage = read("app/reports/lib/report-schedule-storage.ts");
const upload = read("app/api/upload-label/route.ts");
const sendLabel = read("app/send-label/route.ts");

check("user-facing schedule routes use resolveTenantRequest", () => {
  for (const source of [listCreate, remove, sendTest]) {
    assert.ok(source.includes("resolveTenantRequest"));
    assert.ok(!source.includes("getSupabaseAdmin"));
  }
});

check("schedule list/create stamp and filter tenant from request context", () => {
  assert.ok(listCreate.includes("organizationId, propertyId"));
  assert.ok(listCreate.includes("listScheduledReportSchedules(supabase, {"));
  assert.ok(listCreate.includes("organizationId,"));
  assert.ok(listCreate.includes("propertyId,"));
  assert.ok(listCreate.includes("createdBy: user.id"));
  assert.ok(!listCreate.includes("body.createdBy"));
});

check("delete and send-test require tenant-scoped row lookup", () => {
  assert.ok(remove.includes("deleteScheduledReportSchedule(supabase, id, {"));
  assert.ok(remove.includes("organizationId,"));
  assert.ok(remove.includes("propertyId,"));
  assert.ok(sendTest.includes("getScheduledReportScheduleRowForTenant"));
  assert.ok(sendTest.includes("organizationId,"));
  assert.ok(sendTest.includes("propertyId,"));
});

check("db helpers filter organization_id and property_id", () => {
  assert.ok(db.includes(".eq(\"organization_id\", scope.organizationId)"));
  assert.ok(db.includes(".eq(\"property_id\", scope.propertyId)"));
  assert.ok(db.includes("organization_id: organizationId"));
  assert.ok(db.includes("property_id: propertyId"));
});

check("cron remains CRON_SECRET gated and does not use resolveTenantRequest", () => {
  assert.ok(cron.includes("CRON_SECRET"));
  assert.ok(cron.includes("isAuthorizedCronRequest"));
  assert.ok(cron.includes("getSupabaseAdmin"));
  assert.ok(!cron.includes("resolveTenantRequest"));
});

check("client schedule storage sends tenant auth headers", () => {
  assert.ok(storage.includes("tenantFetch"));
  assert.ok(!storage.includes("await fetch("));
});

check("legacy upload-label is disabled and cannot mutate lost_items", () => {
  assert.ok(upload.includes("status: 410") || upload.includes("{ status: 410 }"));
  assert.ok(!upload.includes('.from("lost_items")'));
  assert.ok(!upload.includes("shipping-labels"));
  assert.ok(!upload.includes("SUPABASE_SERVICE_ROLE"));
  assert.ok(!upload.includes("getSupabaseAdmin"));
});

check("legacy POST /send-label is disabled and cannot call Resend", () => {
  assert.ok(sendLabel.includes("status: 410") || sendLabel.includes("{ status: 410 }"));
  assert.ok(!sendLabel.includes("resend"));
  assert.ok(!sendLabel.includes("Resend"));
  assert.ok(!sendLabel.includes("RESEND_"));
  assert.ok(!sendLabel.includes("emails.send"));
  assert.ok(!sendLabel.includes("req.json"));
  assert.ok(!sendLabel.includes("body.email"));
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log("\nAll Pass 1 critical security checks passed.");

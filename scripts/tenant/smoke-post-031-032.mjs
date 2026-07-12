/**
 * Post-031/032 smoke test — page loads + DB write flows matching app patterns.
 * Usage: node scripts/tenant/smoke-post-031-032.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const ROUTES = [
  { name: "Dashboard", path: "/" },
  { name: "Pass-On Log", path: "/pass-on-log" },
  { name: "Work Orders (Maintenance)", path: "/maintenance" },
  { name: "PMs (Maintenance)", path: "/maintenance" },
  { name: "Inspections", path: "/inspections" },
  { name: "Lost & Found", path: "/lost-and-found" },
  { name: "Reports", path: "/reports" },
];

async function checkPages() {
  const results = [];
  for (const route of ROUTES) {
    try {
      const res = await fetch(`${BASE}${route.path}`, { redirect: "follow" });
      const ok = res.status >= 200 && res.status < 400;
      results.push({
        name: route.name,
        path: route.path,
        status: res.status,
        ok,
        error: ok ? null : `HTTP ${res.status}`,
      });
    } catch (err) {
      results.push({
        name: route.name,
        path: route.path,
        status: null,
        ok: false,
        error: err.message,
      });
    }
  }
  return results;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const sb = createClient(url, key);
  const failures = [];
  const passes = [];
  const cleanup = [];

  console.log("=== Page load smoke (HTTP) ===\n");
  const pages = await checkPages();
  for (const p of pages) {
    const line = `${p.ok ? "OK" : "FAIL"}  ${p.name} ${p.path} (${p.status ?? "no response"})`;
    console.log(line);
    if (!p.ok) failures.push({ test: `Page: ${p.name}`, error: p.error || `HTTP ${p.status}` });
    else passes.push(`Page: ${p.name}`);
  }

  // Scheduled reports section loads with reports page
  const reportsOk = pages.find((p) => p.path === "/reports")?.ok;
  console.log(
    reportsOk
      ? "OK    Scheduled Reports (via /reports)"
      : "FAIL  Scheduled Reports (via /reports)"
  );
  if (!reportsOk) failures.push({ test: "Scheduled Reports page", error: "Reports page failed to load" });
  else passes.push("Scheduled Reports page");

  console.log("\n=== DB write smoke (app-equivalent inserts) ===\n");

  // Pass-On reply (matches pass-on-shared.ts — no tenant columns in payload)
  const { data: passOnEntry } = await sb.from("pass_on_log").select("id").limit(1).maybeSingle();
  if (!passOnEntry) {
    failures.push({ test: "Pass-On reply", error: "No pass_on_log row to reply to" });
  } else {
    const marker = `SMOKE_031_032_${Date.now()}`;
    const { data: reply, error } = await sb
      .from("pass_on_log_replies")
      .insert({
        entry_id: passOnEntry.id,
        reply_author: marker,
        reply_message: "Smoke test reply",
      })
      .select("id, organization_id, property_id")
      .single();

    if (error) {
      failures.push({ test: "Pass-On reply", error: error.message });
      console.log(`FAIL  Pass-On reply: ${error.message}`);
    } else {
      if (reply.organization_id == null || reply.property_id == null) {
        failures.push({
          test: "Pass-On reply",
          error: "Insert succeeded but tenant columns not stamped by trigger",
        });
        console.log("FAIL  Pass-On reply: tenant columns null after insert");
      } else {
        passes.push("Pass-On reply");
        console.log(
          `OK    Pass-On reply (org=${reply.organization_id}, property=${reply.property_id})`
        );
        cleanup.push(() => sb.from("pass_on_log_replies").delete().eq("id", reply.id));
      }
    }
  }

  // Inspection item response (matches inspection-db.ts delete+insert pattern)
  const { data: session } = await sb
    .from("inspection_sessions")
    .select("id, organization_id, property_id")
    .limit(1)
    .maybeSingle();

  if (!session) {
    failures.push({ test: "Inspection response save", error: "No inspection_sessions row" });
  } else {
    const { data: existing } = await sb
      .from("inspection_item_responses")
      .select("id, category_key, item_key, label_snapshot, point_value, required, outcome, points_earned, sort_order")
      .eq("inspection_id", session.id)
      .limit(1)
      .maybeSingle();

    const row = existing
      ? {
          inspection_id: session.id,
          category_key: existing.category_key,
          item_key: existing.item_key,
          label_snapshot: existing.label_snapshot,
          point_value: existing.point_value,
          required: existing.required,
          outcome: existing.outcome,
          points_earned: existing.points_earned,
          sort_order: existing.sort_order ?? 0,
        }
      : {
          inspection_id: session.id,
          category_key: "smoke",
          item_key: "smoke_test_item",
          label_snapshot: { en: "Smoke test item" },
          point_value: 1,
          required: false,
          outcome: "pass",
          points_earned: 1,
          sort_order: 0,
        };

    const { data: inserted, error } = await sb
      .from("inspection_item_responses")
      .insert(row)
      .select("id, organization_id, property_id")
      .single();

    if (error) {
      failures.push({ test: "Inspection response save", error: error.message });
      console.log(`FAIL  Inspection response save: ${error.message}`);
    } else {
      if (inserted.organization_id == null || inserted.property_id == null) {
        failures.push({
          test: "Inspection response save",
          error: "Tenant columns not stamped by trigger",
        });
        console.log("FAIL  Inspection response save: tenant columns null");
      } else {
        passes.push("Inspection response save");
        console.log(
          `OK    Inspection response save (org=${inserted.organization_id}, property=${inserted.property_id})`
        );
        if (!existing) cleanup.push(() => sb.from("inspection_item_responses").delete().eq("id", inserted.id));
      }
    }
  }

  // Scheduled report run (matches report-schedule-db.ts insertScheduledReportRun)
  let scheduleId = null;
  const { data: existingSchedule } = await sb
    .from("scheduled_report_schedules")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existingSchedule) {
    scheduleId = existingSchedule.id;
  } else {
    const { data: created, error: createErr } = await sb
      .from("scheduled_report_schedules")
      .insert({
        property_id: 1,
        organization_id: 1,
        report_module: "work_orders",
        report_id: "smoke-test",
        report_name: "Smoke Test Report",
        frequency: "daily",
        interval_unit: "day",
        schedule_time: "08:00",
        start_date: "2026-01-01",
        next_run_at: new Date().toISOString(),
        recipients: "smoke@test.local",
      })
      .select("id")
      .single();

    if (createErr) {
      failures.push({
        test: "Scheduled report run (setup schedule)",
        error: createErr.message,
      });
      console.log(`FAIL  Scheduled report schedule setup: ${createErr.message}`);
    } else {
      scheduleId = created.id;
      cleanup.push(() => sb.from("scheduled_report_schedules").delete().eq("id", scheduleId));
    }
  }

  if (scheduleId) {
    const { data: run, error } = await sb
      .from("scheduled_report_runs")
      .insert({
        schedule_id: scheduleId,
        triggered_by: "test",
        status: "sent",
        error: null,
        resend_message_id: null,
      })
      .select("id, organization_id, property_id")
      .single();

    if (error) {
      failures.push({ test: "Scheduled report run", error: error.message });
      console.log(`FAIL  Scheduled report run: ${error.message}`);
    } else {
      if (run.organization_id == null || run.property_id == null) {
        failures.push({ test: "Scheduled report run", error: "Tenant columns not stamped" });
        console.log("FAIL  Scheduled report run: tenant columns null");
      } else {
        passes.push("Scheduled report run");
        console.log(
          `OK    Scheduled report run (org=${run.organization_id}, property=${run.property_id})`
        );
        cleanup.push(() => sb.from("scheduled_report_runs").delete().eq("id", run.id));
      }
    }
  }

  // Root insert risk check (informational — app paths that 032 does NOT fix)
  const { error: rootPassOnErr } = await sb
    .from("pass_on_log")
    .insert({
      subject: "SMOKE_ROOT_SHOULD_FAIL_OR_PASS",
      author: "smoke",
      priority: "Normal",
      message: "root insert probe",
      entry_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .maybeSingle();

  if (rootPassOnErr) {
    console.log(`INFO  Root pass_on_log create (app path): blocked — ${rootPassOnErr.message}`);
  } else {
    console.log("WARN  Root pass_on_log create without tenant columns succeeded (unexpected post-031)");
    const { data: probe } = await sb
      .from("pass_on_log")
      .select("id")
      .eq("subject", "SMOKE_ROOT_SHOULD_FAIL_OR_PASS")
      .maybeSingle();
    if (probe) cleanup.push(() => sb.from("pass_on_log").delete().eq("id", probe.id));
  }

  for (const fn of cleanup.reverse()) {
    try {
      await fn();
    } catch {
      /* best-effort cleanup */
    }
  }

  console.log("\n=== Summary ===\n");
  console.log(`Passed: ${passes.length}`);
  console.log(`Failed: ${failures.length}`);

  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f.test}: ${f.error}`);
    process.exit(1);
  }

  console.log("\nAll smoke checks passed. Clear to review 033.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Security Fix #4 Phase A — app-only shipping-label privacy.
 * Static source assertions plus parser regression tests.
 * Does not modify production data, buckets, or RLS.
 *
 * Usage: node scripts/tenant/verify-security-fix-4-phase-a.mjs
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function readIfPresent(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

function collectAppSourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectAppSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
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

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`pass  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`fail  ${name}`);
    console.error(`      ${error instanceof Error ? error.message : error}`);
  }
}

const actionsMenu = read("app/lost-and-found/components/LostFoundItemActionsMenu.tsx");
const shippingSection = read(
  "app/lost-and-found/components/LostFoundShippingSection.tsx"
);
const lnfPage = read("app/lost-and-found/page.tsx");
const lnfList = read("app/api/lost-and-found/route.ts");
const lnfItem = read("app/api/lost-and-found/[id]/route.ts");
const historicalRoute = read(
  "app/api/lost-and-found/[id]/historical-label/route.ts"
);
const historicalAccess = read(
  "app/lib/lost-found-shipping/historical-label-access.ts"
);
const privateLabelRoute = read(
  "app/api/lost-and-found/[id]/shipping-requests/[requestId]/label/route.ts"
);
const purchase = read("app/lib/lost-found-shipping/purchase-label-for-request.ts");
const sendEmail = read("app/api/send-email/route.ts");
const uploadLabel = read("app/api/upload-label/route.ts");
const sendLabel = read("app/send-label/route.ts");
const labelPage = read("app/label/page.tsx");
const sendForm = read("app/SendLabelRequestForm.tsx");
const labelForm = read("app/LabelRequestForm.tsx");
const reportData = read("app/reports/lib/lost-found-report-data.ts");
const reportTypes = read("app/reports/lib/lost-found-report-types.ts");
const reportSample = read("app/reports/lib/lost-found-report-sample-data.ts");
const reportPdf = readIfPresent("app/reports/lib/lost-found-report-pdf-tables.ts");

check("staff reprint uses tenant-authorized historical-label API", () => {
  assert.ok(historicalRoute.includes("resolveTenantRequest"));
  assert.ok(historicalRoute.includes("createHistoricalShippingLabelSignedUrl"));
  assert.ok(historicalAccess.includes("assertLostItemInTenant"));
  assert.ok(historicalAccess.includes("createSignedUrl"));
  assert.ok(historicalAccess.includes("shipping-labels"));
  assert.ok(!historicalAccess.includes("lost-found-shipping-labels"));
  assert.ok(!historicalAccess.includes("getPublicUrl"));
});

check("item menu no longer opens raw public label_url", () => {
  assert.ok(!actionsMenu.includes("item.label_url"));
  assert.ok(!actionsMenu.includes("window.open"));
  assert.ok(actionsMenu.includes("has_historical_shipping_label"));
  assert.ok(actionsMenu.includes("fetchStaffShippingLabelUrl"));
  assert.ok(actionsMenu.includes("labelStoragePath"));
});

check("shipping Print Label does not treat historical URL as a private label", () => {
  assert.ok(!shippingSection.includes("itemLabelUrl"));
  assert.ok(!shippingSection.includes("hasUsableLabel"));
  assert.ok(shippingSection.includes("hasHistoricalShippingLabel"));
  assert.ok(shippingSection.includes("hasPrivateLabel"));
  assert.ok(shippingSection.includes("historical-label") || shippingSection.includes("fetchStaffShippingLabelUrl"));
  assert.ok(
    shippingSection.includes("shippingRequestId: hasPrivateLabel(activeRequest)")
  );
});

check("lost-and-found page does not pass raw label_url into the shipping section", () => {
  assert.ok(!lnfPage.includes("itemLabelUrl"));
  assert.ok(!lnfPage.includes("selectedItem.label_url"));
  assert.ok(lnfPage.includes("hasHistoricalShippingLabel"));
  assert.ok(lnfPage.includes("has_historical_shipping_label"));
});

check("lost-item APIs redact public label_url from client payloads", () => {
  assert.ok(lnfList.includes("redactLostItemLabelUrlForClient"));
  assert.ok(lnfItem.includes("redactLostItemLabelUrlForClient"));
});

check("current private-label print path is unchanged", () => {
  assert.ok(privateLabelRoute.includes("createShippingLabelSignedUrl"));
  assert.ok(privateLabelRoute.includes("resolveTenantRequest"));
  assert.ok(
    purchase.includes(
      "`${input.organizationId}/${input.propertyId}/${input.shippingRequestId}/label.pdf`"
    )
  );
  assert.ok(purchase.includes("lost-found-shipping-labels"));
});

check("legacy guest-upload and manual email endpoints are gone", () => {
  for (const source of [sendEmail, uploadLabel, sendLabel]) {
    assert.ok(source.includes("status: 410") || source.includes("{ status: 410 }"));
    assert.ok(!source.includes('.from("lost_items")'));
    assert.ok(!source.includes("Resend"));
    assert.ok(!source.includes("emails.send"));
  }
  assert.ok(!labelPage.includes("/api/upload-label"));
  assert.ok(!labelPage.includes("type=\"file\""));
  assert.ok(labelPage.includes("no longer available"));
  assert.ok(!sendForm.includes("/api/send-email"));
  assert.ok(!labelForm.includes("/api/send-email"));
});

check("no runtime caller posts to /api/send-email", () => {
  const callers = [];
  for (const file of collectAppSourceFiles(path.join(root, "app"))) {
    const rel = path.relative(root, file).replaceAll("\\", "/");
    if (rel === "app/api/send-email/route.ts") continue;
    const stripped = fs
      .readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    if (stripped.includes("/api/send-email")) callers.push(rel);
  }
  assert.deepStrictEqual(callers, []);
});

check("reports do not expose raw public shipping-label URLs", () => {
  assert.ok(!reportTypes.includes("labelUrl"));
  assert.ok(!reportData.includes("labelUrl"));
  assert.ok(!reportData.includes("label_url"));
  assert.ok(!reportSample.includes("labelUrl"));
  assert.ok(!reportSample.includes("shipping-labels"));
  if (reportPdf == null) {
    console.log(
      "info  lost-found-report-pdf-tables.ts not present; checked committed report data/types/sample only"
    );
  } else {
    assert.ok(!reportPdf.includes("labelUrl"));
    assert.ok(!reportPdf.includes("label_url"));
    assert.ok(!reportPdf.includes("shipping-labels"));
  }
});

await checkAsync("historical path parser accepts tenant-safe public URLs only", async () => {
  const mod = await import(
    pathToFileURL(
      path.join(root, "app/lib/lost-found-shipping/historical-label-path.ts")
    ).href
  );
  const parse = mod.parsePublicShippingLabelsObjectPath;
  const allowed = mod.isHistoricalLabelPathAllowedForTenant;
  const redact = mod.redactLostItemLabelUrlForClient;

  const prefixed =
    "https://iodvqycsyequfdhjqchf.supabase.co/storage/v1/object/public/shipping-labels/org-1/property-2/9-label.pdf";
  const flat =
    "https://iodvqycsyequfdhjqchf.supabase.co/storage/v1/object/public/shipping-labels/legacy-label.pdf";
  assert.strictEqual(
    parse(prefixed),
    "org-1/property-2/9-label.pdf"
  );
  assert.strictEqual(parse(flat), "legacy-label.pdf");
  assert.strictEqual(
    parse(
      "https://iodvqycsyequfdhjqchf.supabase.co/storage/v1/object/public/lost-found-shipping-labels/1/2/3/label.pdf"
    ),
    null
  );
  assert.strictEqual(parse("https://example.com/labels/lnf-1002"), null);
  assert.strictEqual(parse("../etc/passwd"), null);
  assert.ok(allowed("org-1/property-2/9-label.pdf", 1, 2));
  assert.ok(!allowed("org-9/property-9/9-label.pdf", 1, 2));
  assert.ok(allowed("legacy-label.pdf", 1, 2));

  const redacted = redact({
    id: 1,
    label_url: prefixed,
    item_name: "Keys",
  });
  assert.strictEqual(redacted.has_historical_shipping_label, true);
  assert.strictEqual("label_url" in redacted, false);
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log("\nAll Security Fix #4 Phase A checks passed.");

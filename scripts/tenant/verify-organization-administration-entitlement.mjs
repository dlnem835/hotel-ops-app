/**
 * Admin Portal access regression test (LIVE HTTP + DB).
 *
 * Access to the customer Admin Portal (/admin-portal) requires BOTH:
 *   1. organization_modules.admin_portal.enabled = true   (org-level)
 *   2. organization_users.org_admin_portal_access = true  (per-user)
 *
 * This script toggles both flags directly in the database (One Eyrie controls
 * them; the customer API can never write them) and asserts the guard behaves
 * as a strict AND across all four combinations, plus:
 *   - The customer org edit endpoint is blocked (403) even with full access.
 *   - The platform owner keeps /api/admin/me; the target never reaches /admin.
 *
 * Original values are restored on exit.
 *
 * Requires the dev server running (npm run dev) or SMOKE_BASE_URL.
 *
 * Usage:
 *   node scripts/tenant/verify-organization-administration-entitlement.mjs
 *   node scripts/tenant/verify-organization-administration-entitlement.mjs --user <auth_user_id> --org <org_id>
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import { getAccessToken, pass, fail } from "./tenant-verify-auth.mjs";

loadEnvLocal();

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const ADMIN_PORTAL_MODULE_KEY = "admin_portal";

function parseArgs(argv) {
  const args = { user: null, org: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--user") args.user = argv[i + 1] ?? null;
    if (argv[i] === "--org") args.org = argv[i + 1] ?? null;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const PLATFORM_USER_ID = args.user ?? "218acb05-7fae-4289-9547-74e55405ba07";
const ORG_ID = Number.parseInt(String(args.org ?? "1"), 10);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function status(path, token, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init.headers ?? {}) },
  });
  return res.status;
}

async function accessProbe(token) {
  const res = await fetch(`${BASE}/api/org-admin/access`, {
    headers: authHeaders(token),
  });
  const body = await res.json().catch(() => ({}));
  return Boolean(body?.hasAccess);
}

// --- entitlement (per-user) -------------------------------------------------
async function readEntitlement(userId) {
  const { data } = await admin
    .from("organization_users")
    .select("org_admin_portal_access")
    .eq("organization_id", ORG_ID)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.org_admin_portal_access);
}

async function setEntitlement(userId, enabled) {
  const { error } = await admin
    .from("organization_users")
    .update({ org_admin_portal_access: enabled })
    .eq("organization_id", ORG_ID)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// --- module (org-level) -----------------------------------------------------
async function readModule() {
  const { data } = await admin
    .from("organization_modules")
    .select("enabled")
    .eq("organization_id", ORG_ID)
    .eq("module_key", ADMIN_PORTAL_MODULE_KEY)
    .maybeSingle();
  return data ? Boolean(data.enabled) : null; // null = row absent
}

async function setModule(enabled) {
  const { error } = await admin
    .from("organization_modules")
    .upsert(
      {
        organization_id: ORG_ID,
        module_key: ADMIN_PORTAL_MODULE_KEY,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,module_key" }
    );
  if (error) throw new Error(error.message);
}

async function findTargetMember() {
  const { data } = await admin
    .from("organization_users")
    .select("user_id, active")
    .eq("organization_id", ORG_ID)
    .eq("active", true);
  const candidate = (data ?? []).find((row) => row.user_id !== PLATFORM_USER_ID);
  return candidate?.user_id ?? null;
}

async function main() {
  let failures = 0;

  const probe = await fetch(`${BASE}/api/tenant/context`).catch(() => null);
  if (!probe) {
    console.error(
      `Cannot reach ${BASE}. Start the dev server (npm run dev) or set SMOKE_BASE_URL.`
    );
    process.exit(2);
  }

  const platformToken = await getAccessToken(admin, PLATFORM_USER_ID);

  const adminMe = await status("/api/admin/me", platformToken);
  failures +=
    adminMe === 200
      ? pass("Platform owner retains /api/admin/me (200)")
      : fail("Platform owner lost /api/admin/me", `status ${adminMe}`);

  const targetUserId = await findTargetMember();
  if (!targetUserId) {
    console.log("SKIP  No non-owner member found in org — cannot test gating.");
    finish(failures);
    return;
  }

  const originalEntitlement = await readEntitlement(targetUserId);
  const originalModule = await readModule();
  const targetToken = await getAccessToken(admin, targetUserId);

  // Target must never reach the internal /admin portal.
  const targetAdmin = await status("/api/admin/me", targetToken);
  failures +=
    targetAdmin === 403 || targetAdmin === 401
      ? pass("Target cannot reach internal /api/admin/me (403/401)")
      : fail("Target unexpectedly reached /admin", `status ${targetAdmin}`);

  const matrix = [
    { module: true, user: true, expectAccess: true },
    { module: true, user: false, expectAccess: false },
    { module: false, user: true, expectAccess: false },
    { module: false, user: false, expectAccess: false },
  ];

  try {
    for (const combo of matrix) {
      await setModule(combo.module);
      await setEntitlement(targetUserId, combo.user);

      const label = `module=${combo.module ? "on" : "off"} + user=${
        combo.user ? "on" : "off"
      }`;

      const hasAccess = await accessProbe(targetToken);
      failures +=
        hasAccess === combo.expectAccess
          ? pass(`Access probe correct (${label} → ${combo.expectAccess})`)
          : fail(`Access probe wrong (${label})`, `got hasAccess=${hasAccess}`);

      const portal = await status(
        `/api/org-admin/organizations/${ORG_ID}`,
        targetToken
      );
      const portalOk = combo.expectAccess ? portal === 200 : portal === 403;
      failures += portalOk
        ? pass(`Portal API correct (${label} → ${combo.expectAccess ? 200 : 403})`)
        : fail(`Portal API wrong (${label})`, `status ${portal}`);
    }

    // With full access, the customer org edit endpoint must still be blocked.
    await setModule(true);
    await setEntitlement(targetUserId, true);
    const editStatus = await status(
      `/api/org-admin/organizations/${ORG_ID}`,
      targetToken,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Should Not Save" }),
      }
    );
    failures +=
      editStatus === 403
        ? pass("Customer org edit blocked with full access (403)")
        : fail("Customer org edit not blocked", `status ${editStatus}`);
  } finally {
    await setEntitlement(targetUserId, originalEntitlement).catch(() => {});
    if (originalModule === null) {
      await admin
        .from("organization_modules")
        .delete()
        .eq("organization_id", ORG_ID)
        .eq("module_key", ADMIN_PORTAL_MODULE_KEY)
        .then(() => {}, () => {});
    } else {
      await setModule(originalModule).catch(() => {});
    }
  }

  finish(failures);
}

function finish(failures) {
  console.log("");
  if (failures > 0) {
    console.error(`ADMIN PORTAL ACCESS CHECK FAILED (${failures} issue(s)).`);
    process.exit(1);
  }
  console.log(
    "ADMIN PORTAL ACCESS OK — two-key AND gate enforced, customer edit blocked, /admin stays platform-only."
  );
}

main().catch((error) => {
  console.error("Verification error:", error?.message ?? error);
  process.exit(1);
});

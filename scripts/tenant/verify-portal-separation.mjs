/**
 * Portal separation + dual-access regression test (LIVE HTTP).
 *
 * Proves the Platform Admin (/api/admin) vs Organization Admin (/api/org-admin)
 * split behaves correctly and — critically — that a SINGLE authenticated account
 * keeps BOTH access layers after the refactor:
 *
 *   1. DUAL ACCESS (one token):  the platform owner's token is accepted by BOTH
 *        GET /api/admin/me                       (platform portal)  -> 200
 *        GET /api/org-admin/organizations/{ORG}  (customer portal)  -> 200
 *
 *   2. GUARD SEPARATION:  a property-scoped-only member (no org-wide role and not
 *      a platform admin) is rejected by BOTH admin surfaces:
 *        GET /api/org-admin/organizations/{ORG}  -> 403
 *        GET /api/admin/me                       -> 403
 *
 *   3. CROSS-ORG ISOLATION:  the platform owner's token cannot read an org they
 *      are not a member of through the customer portal:
 *        GET /api/org-admin/organizations/{OTHER} -> 403/404
 *
 * Requires the dev server running (npm run dev) or SMOKE_BASE_URL.
 *
 * Usage:
 *   node scripts/tenant/verify-portal-separation.mjs
 *   node scripts/tenant/verify-portal-separation.mjs --user <auth_user_id> --org <org_id>
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import { getAccessToken, pass, fail } from "./tenant-verify-auth.mjs";

loadEnvLocal();

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";

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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORG_WIDE_ROLES = new Set(["org_owner", "org_admin"]);

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function status(path, token) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(token) });
  return res.status;
}

async function isPlatformAdmin(userId) {
  const { data } = await admin
    .from("platform_admins")
    .select("id")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  return Boolean(data);
}

/** Find an active member of ORG who is NOT org-wide and NOT a platform admin. */
async function findPropertyOnlyMember(organizationId) {
  const { data: orgMembers } = await admin
    .from("organization_users")
    .select("user_id, role, active")
    .eq("organization_id", organizationId)
    .eq("active", true);

  const orgWideByUser = new Map();
  for (const row of orgMembers ?? []) {
    if (ORG_WIDE_ROLES.has(row.role)) orgWideByUser.set(row.user_id, true);
  }

  const { data: propMembers } = await admin
    .from("user_properties")
    .select("user_id, property_id, active, properties(organization_id)")
    .eq("active", true);

  for (const row of propMembers ?? []) {
    const belongsToOrg = row.properties?.organization_id === organizationId;
    if (!belongsToOrg) continue;
    if (orgWideByUser.has(row.user_id)) continue;
    if (await isPlatformAdmin(row.user_id)) continue;
    return row.user_id;
  }
  return null;
}

/** Find an org id the platform user is NOT an org-wide member of. */
async function findForeignOrgId(userId, excludeOrgId) {
  const { data: memberships } = await admin
    .from("organization_users")
    .select("organization_id, role, active")
    .eq("user_id", userId);
  const orgWideOrgIds = new Set(
    (memberships ?? [])
      .filter((r) => r.active && ORG_WIDE_ROLES.has(r.role))
      .map((r) => r.organization_id)
  );

  const { data: orgs } = await admin
    .from("organizations")
    .select("id")
    .neq("id", excludeOrgId);
  for (const org of orgs ?? []) {
    if (!orgWideOrgIds.has(org.id)) return org.id;
  }
  return null;
}

async function main() {
  let failures = 0;

  // Reachability probe
  const probe = await fetch(`${BASE}/api/tenant/context`).catch(() => null);
  if (!probe) {
    console.error(`Cannot reach ${BASE}. Start the dev server (npm run dev) or set SMOKE_BASE_URL.`);
    process.exit(2);
  }

  // 1. DUAL ACCESS — one token, both portals
  const platformToken = await getAccessToken(admin, PLATFORM_USER_ID);

  const adminMe = await status("/api/admin/me", platformToken);
  failures +=
    adminMe === 200
      ? pass("Platform portal: /api/admin/me accepts platform owner (200)")
      : fail("Platform portal: /api/admin/me rejected platform owner", `status ${adminMe}`);

  const orgSelf = await status(`/api/org-admin/organizations/${ORG_ID}`, platformToken);
  failures +=
    orgSelf === 200
      ? pass("Customer portal: /api/org-admin/organizations/{ORG} accepts same account (200)")
      : fail("Customer portal: same account rejected", `status ${orgSelf}`);

  if (adminMe === 200 && orgSelf === 200) {
    pass("DUAL ACCESS intact — one token authorized for BOTH portals");
  } else {
    failures += fail("DUAL ACCESS broken — a single account no longer reaches both portals");
  }

  // 2. GUARD SEPARATION — property-only member rejected by both surfaces
  const propOnlyUser = await findPropertyOnlyMember(ORG_ID);
  if (!propOnlyUser) {
    console.log("SKIP  Guard separation — no property-only, non-platform member found in org.");
  } else {
    const propToken = await getAccessToken(admin, propOnlyUser);

    const orgDenied = await status(`/api/org-admin/organizations/${ORG_ID}`, propToken);
    failures +=
      orgDenied === 403
        ? pass("Customer portal rejects property-only member (403)")
        : fail("Customer portal did NOT reject property-only member", `status ${orgDenied}`);

    const adminDenied = await status("/api/admin/me", propToken);
    failures +=
      adminDenied === 403 || adminDenied === 401
        ? pass("Platform portal rejects non-platform member (403/401)")
        : fail("Platform portal did NOT reject non-platform member", `status ${adminDenied}`);
  }

  // 3. CROSS-ORG ISOLATION
  const foreignOrg = await findForeignOrgId(PLATFORM_USER_ID, ORG_ID);
  if (foreignOrg == null) {
    console.log("SKIP  Cross-org isolation — no foreign org available to test.");
  } else {
    const foreign = await status(`/api/org-admin/organizations/${foreignOrg}`, platformToken);
    failures +=
      foreign === 403 || foreign === 404
        ? pass(`Customer portal blocks non-member org ${foreignOrg} (${foreign})`)
        : fail(`Customer portal leaked non-member org ${foreignOrg}`, `status ${foreign}`);
  }

  console.log("");
  if (failures > 0) {
    console.error(`PORTAL SEPARATION CHECK FAILED (${failures} issue(s)).`);
    process.exit(1);
  }
  console.log("PORTAL SEPARATION OK — dual access preserved and guards enforce the split.");
}

main().catch((error) => {
  console.error("Verification error:", error?.message ?? error);
  process.exit(1);
});

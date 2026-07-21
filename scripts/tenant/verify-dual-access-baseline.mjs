/**
 * Dual-access baseline verification (READ-ONLY).
 *
 * Confirms that a single authenticated account holds BOTH access layers and
 * that neither is affected by the Platform Admin vs Organization Admin split:
 *   1. Platform access — active platform_admins row (role platform_owner/platform_admin)
 *   2. Org admin access — active organization_users row that is org-wide
 *                         (org_owner Primary Owner OR org_admin Organization Admin)
 *   3. Property access  — org-wide expansion still yields every active property
 *
 * Note: the customer Organization Administration portal (/settings/organization)
 * admits BOTH org_owner and org_admin. This account (dlnem360) is a BBL
 * org_admin; BBL's Primary Owner is a separate account. Both layers are valid.
 *
 * This script makes NO writes. It only reports the current state so we can
 * compare a "before" snapshot to an "after" snapshot around the refactor.
 *
 * Usage:
 *   node scripts/tenant/verify-dual-access-baseline.mjs
 *   node scripts/tenant/verify-dual-access-baseline.mjs --user <auth_user_id> --org <org_id>
 *
 * Defaults target the platform owner's BBL Hospitality account.
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

function parseArgs(argv) {
  const args = { user: null, org: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--user") args.user = argv[i + 1] ?? null;
    if (argv[i] === "--org") args.org = argv[i + 1] ?? null;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const USER_ID = args.user ?? "218acb05-7fae-4289-9547-74e55405ba07";
const ORG_ID = Number.parseInt(String(args.org ?? "1"), 10);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORG_WIDE_ROLES = new Set(["org_owner", "org_admin"]);

async function main() {
  const failures = [];

  const { data: authUser, error: authErr } = await sb.auth.admin.getUserById(USER_ID);
  if (authErr) throw authErr;

  const { data: platformAdmin, error: paErr } = await sb
    .from("platform_admins")
    .select("id, user_id, role, active")
    .eq("user_id", USER_ID)
    .eq("active", true)
    .maybeSingle();
  if (paErr) throw paErr;

  const { data: orgUsers, error: ouErr } = await sb
    .from("organization_users")
    .select("organization_id, user_id, role, active, organizations(id, name, slug, status)")
    .eq("user_id", USER_ID);
  if (ouErr) throw ouErr;

  const { data: userProps, error: upErr } = await sb
    .from("user_properties")
    .select("user_id, property_id, role, active, is_default, properties(id, name, active, organization_id)")
    .eq("user_id", USER_ID);
  if (upErr) throw upErr;

  const { data: activeProps, error: apErr } = await sb
    .from("properties")
    .select("id, name, active, organization_id")
    .eq("organization_id", ORG_ID)
    .eq("active", true);
  if (apErr) throw apErr;

  const orgRow = (orgUsers ?? []).find((r) => r.organization_id === ORG_ID) ?? null;
  const orgRole = orgRow?.role ?? null;
  const isOrgWide = orgRole ? ORG_WIDE_ROLES.has(orgRole) : false;
  const platformGrantsOrgWide = Boolean(platformAdmin);

  const orgWideYield = isOrgWide || platformGrantsOrgWide
    ? (activeProps?.length ?? 0)
    : (userProps ?? []).filter((r) => r.active).length;

  // Assertions
  if (!platformAdmin) {
    failures.push("Platform access MISSING — no active platform_admins row.");
  }
  if (!orgRow) {
    failures.push(`Organization membership MISSING for org ${ORG_ID}.`);
  } else if (!ORG_WIDE_ROLES.has(orgRole)) {
    failures.push(
      `Org-wide administration NOT held — org role is '${orgRole}', expected 'org_owner' or 'org_admin'.`
    );
  } else if (orgRow.active !== true) {
    failures.push("Organization membership is INACTIVE.");
  }
  if (orgWideYield < 1) {
    failures.push("Org-wide property access would yield 0 properties.");
  }

  const report = {
    checked_at: new Date().toISOString(),
    user_id: USER_ID,
    organization_id: ORG_ID,
    auth_email: authUser?.user?.email ?? null,
    platform_access: {
      has_active_platform_admin_row: Boolean(platformAdmin),
      role: platformAdmin?.role ?? null,
    },
    organization_access: {
      org_role: orgRole,
      is_primary_owner: orgRole === "org_owner",
      is_organization_admin: orgRole === "org_admin",
      is_org_wide_admin: ORG_WIDE_ROLES.has(orgRole),
      active: orgRow?.active ?? null,
      organization: orgRow?.organizations ?? null,
    },
    property_access: {
      is_org_wide: isOrgWide,
      platform_admin_grants_org_wide: platformGrantsOrgWide,
      active_properties_in_org: activeProps?.length ?? 0,
      org_wide_expansion_would_yield: orgWideYield,
      explicit_user_properties: (userProps ?? []).map((r) => ({
        property_id: r.property_id,
        role: r.role,
        active: r.active,
      })),
    },
    dual_access_ok: failures.length === 0,
    failures,
  };

  console.log(JSON.stringify(report, null, 2));

  if (failures.length > 0) {
    console.error(`\nDUAL ACCESS CHECK FAILED (${failures.length} issue(s)).`);
    process.exit(1);
  }
  console.log("\nDUAL ACCESS OK — platform access + org-wide administration both intact.");
}

main().catch((error) => {
  console.error("Verification error:", error?.message ?? error);
  process.exit(1);
});

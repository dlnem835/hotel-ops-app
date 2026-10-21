/**
 * Property inspection template authorization (migration 068).
 *
 * Covers org owners, org admins, property admins, Settings staff,
 * unauthorized users, inactive memberships, job-title-only rows, and
 * cross-organization access. Also statically checks API + SQL wiring.
 *
 * Usage: npx tsx scripts/tenant/verify-inspection-template-access.ts
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  canManagePropertyInspectionTemplates,
  type InspectionTemplateAccessSnapshot,
} from "@/app/lib/tenant/server/property-inspection-template-access";

const root = process.cwd();
const home = { organizationId: 10, propertyId: 101 };
const otherHomeProperty = { organizationId: 10, propertyId: 102 };
const otherOrg = { organizationId: 20, propertyId: 201 };

function snapshot(
  overrides: Partial<InspectionTemplateAccessSnapshot> = {}
): InspectionTemplateAccessSnapshot {
  return {
    organizationStatus: "active",
    organizationUser: { role: "org_member", active: true },
    property: { organizationId: home.organizationId, active: true },
    userProperty: {
      role: "property_staff",
      active: true,
      modulePermissions: {},
    },
    teamMember: {
      status: "Active",
      canLogin: true,
      modulePermissions: {},
    },
    ...overrides,
  };
}

function allow(
  name: string,
  row: InspectionTemplateAccessSnapshot,
  scope = home
) {
  assert.strictEqual(
    canManagePropertyInspectionTemplates(row, scope),
    true,
    name
  );
}

function deny(
  name: string,
  row: InspectionTemplateAccessSnapshot,
  scope = home
) {
  assert.strictEqual(
    canManagePropertyInspectionTemplates(row, scope),
    false,
    name
  );
}

function runDecisionTests() {
  allow(
    "organization owner can manage home property",
    snapshot({ organizationUser: { role: "org_owner", active: true } })
  );
  allow(
    "organization owner can manage another active property in the same org",
    snapshot({
      organizationUser: { role: "org_owner", active: true },
      property: { organizationId: home.organizationId, active: true },
      userProperty: null,
      teamMember: null,
    }),
    otherHomeProperty
  );
  deny(
    "organization owner cannot manage a property in another organization",
    snapshot({
      organizationUser: null,
      property: { organizationId: otherOrg.organizationId, active: true },
      userProperty: null,
      teamMember: null,
    }),
    otherOrg
  );
  deny(
    "inactive organization owner cannot manage templates",
    snapshot({
      organizationUser: { role: "org_owner", active: false },
    })
  );

  allow(
    "organization admin can manage home property",
    snapshot({ organizationUser: { role: "org_admin", active: true } })
  );
  allow(
    "organization admin can manage another active property in the same org",
    snapshot({
      organizationUser: { role: "org_admin", active: true },
      userProperty: null,
      teamMember: null,
    }),
    otherHomeProperty
  );
  deny(
    "organization admin cannot manage a property in another organization",
    snapshot({
      organizationUser: null,
      property: { organizationId: otherOrg.organizationId, active: true },
      userProperty: null,
      teamMember: null,
    }),
    otherOrg
  );
  deny(
    "inactive organization admin cannot manage templates",
    snapshot({
      organizationUser: { role: "org_admin", active: false },
    })
  );

  allow(
    "property admin can manage an assigned property",
    snapshot({
      userProperty: {
        role: "property_admin",
        active: true,
        modulePermissions: {},
      },
    })
  );
  deny(
    "property admin cannot manage an unassigned property",
    snapshot({
      userProperty: null,
      teamMember: null,
    }),
    otherHomeProperty
  );
  deny(
    "inactive property-admin assignment cannot manage templates",
    snapshot({
      userProperty: {
        role: "property_admin",
        active: false,
        modulePermissions: {},
      },
    })
  );

  allow(
    "Settings-authorized staff can manage their property via user_properties",
    snapshot({
      userProperty: {
        role: "property_staff",
        active: true,
        modulePermissions: { settings: true },
      },
    })
  );
  allow(
    "Settings-authorized staff can manage their property via team_members",
    snapshot({
      userProperty: {
        role: "property_staff",
        active: true,
        modulePermissions: {},
      },
      teamMember: {
        status: "Active",
        canLogin: true,
        modulePermissions: { settings: true },
      },
    })
  );
  deny(
    "Settings on another property does not grant this property",
    snapshot({
      property: { organizationId: home.organizationId, active: true },
      userProperty: null,
      teamMember: null,
    }),
    otherHomeProperty
  );
  deny(
    "inactive team member Settings cannot manage templates",
    snapshot({
      teamMember: {
        status: "Inactive",
        canLogin: true,
        modulePermissions: { settings: true },
      },
    })
  );
  deny(
    "disabled login Settings cannot manage templates",
    snapshot({
      teamMember: {
        status: "Active",
        canLogin: false,
        modulePermissions: { settings: true },
      },
    })
  );
  deny(
    "inactive user_properties Settings cannot manage templates",
    snapshot({
      userProperty: {
        role: "property_staff",
        active: false,
        modulePermissions: { settings: true },
      },
      teamMember: {
        status: "Active",
        canLogin: true,
        modulePermissions: {},
      },
    })
  );

  deny(
    "General Manager job title alone cannot manage templates",
    snapshot({
      userProperty: {
        role: "property_staff",
        active: true,
        modulePermissions: {},
      },
      teamMember: {
        status: "Active",
        canLogin: true,
        modulePermissions: {},
      },
    })
  );
  deny(
    "unauthorized inspector cannot manage templates",
    snapshot()
  );
  deny(
    "org_billing cannot manage templates",
    snapshot({ organizationUser: { role: "org_billing", active: true } })
  );
  deny(
    "property_manager without Settings cannot manage templates",
    snapshot({
      userProperty: {
        role: "property_manager",
        active: true,
        modulePermissions: {},
      },
    })
  );
  deny(
    "no organization membership cannot manage templates",
    snapshot({ organizationUser: null })
  );
  deny(
    "suspended organization cannot grant template writes",
    snapshot({
      organizationStatus: "suspended",
      organizationUser: { role: "org_owner", active: true },
    })
  );
  deny(
    "inactive property cannot be managed",
    snapshot({
      organizationUser: { role: "org_owner", active: true },
      property: { organizationId: home.organizationId, active: false },
    })
  );
  deny(
    "cross-organization property row cannot grant access",
    snapshot({
      organizationUser: { role: "org_owner", active: true },
      property: { organizationId: otherOrg.organizationId, active: true },
    }),
    home
  );
}

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function runStaticChecks() {
  const sql = read(
    "supabase/migrations/068_property_inspection_template_settings_writes.sql"
  );
  const access = read(
    "app/lib/tenant/server/property-inspection-template-access.ts"
  );
  const listRoute = read("app/api/property-inspection-templates/route.ts");
  const idRoute = read("app/api/property-inspection-templates/[id]/route.ts");
  const restoreRoute = read(
    "app/api/property-inspection-templates/[id]/restore-standard/route.ts"
  );
  const sessionsRoute = read("app/api/inspections/sessions/route.ts");

  assert.ok(sql.includes("BEGIN;"));
  assert.ok(sql.includes("COMMIT;"));
  assert.ok(
    sql.includes("auth_user_can_manage_property_inspection_templates")
  );
  assert.ok(!sql.includes("auth_team_member_can_manage_team("));
  assert.ok(!sql.includes("General Manager"));
  assert.ok(!sql.includes("Assistant General Manager"));
  assert.ok(sql.includes("org_owner"));
  assert.ok(sql.includes("org_admin"));
  assert.ok(sql.includes("property_admin"));
  assert.ok(sql.includes("module_permissions->>'settings'"));
  assert.ok(sql.includes("ou.active = true"));
  assert.ok(sql.includes("up.active = true"));
  assert.ok(sql.includes("tm.status = 'Active'"));
  assert.ok(sql.includes("can_login"));
  assert.ok(
    !sql.includes("DROP POLICY IF EXISTS tenant_property_inspection_templates_select")
  );
  const sqlDdl = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  assert.ok(!sqlDdl.includes("inspection_sessions"));
  assert.ok(!sqlDdl.includes("template_snapshot"));
  assert.ok(!sqlDdl.includes("CREATE TABLE"));
  assert.ok(!sqlDdl.includes("ALTER TABLE"));

  assert.ok(access.includes("isOrgWideRole"));
  assert.ok(access.includes("PROPERTY_ROLE.propertyAdministrator"));
  assert.ok(!access.includes("General Manager"));
  assert.ok(!access.includes("jobTitle"));

  for (const source of [listRoute, idRoute, restoreRoute]) {
    assert.ok(source.includes("assertCanManagePropertyInspectionTemplates"));
    assert.ok(!source.includes("assertCanManageSettings"));
  }

  const listGet = listRoute.slice(
    listRoute.indexOf("export async function GET"),
    listRoute.indexOf("export async function POST")
  );
  assert.ok(!listGet.includes("assertCanManagePropertyInspectionTemplates"));

  const idGet = idRoute.slice(
    idRoute.indexOf("export async function GET"),
    idRoute.indexOf("export async function PATCH")
  );
  assert.ok(!idGet.includes("assertCanManagePropertyInspectionTemplates"));

  assert.ok(!sessionsRoute.includes("assertCanManagePropertyInspectionTemplates"));
  assert.ok(sessionsRoute.includes("fetchActiveTemplates"));
  assert.ok(sessionsRoute.includes("createInspectionSession"));
}

runDecisionTests();
runStaticChecks();
console.log("pass  inspection template authorization");

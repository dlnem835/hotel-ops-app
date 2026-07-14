/**
 * Platform admin portal — Administrator disable / remove verification.
 *
 * Covers platform_owner-gated permanent removal, disable/enable, Primary Owner
 * protections, pending cancel vs remove, multi-org isolation, history retention,
 * and refusal to self-target the active platform owner via this workflow.
 *
 * Requires: npm run dev (or SMOKE_BASE_URL) and SUPPRESS_AUTH_EMAILS=true.
 *
 * Usage: node scripts/tenant/verify-platform-admin-administrator-remove.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import { assertAuthEmailsSuppressed, testEmail } from "./auth-email-guard.mjs";
import {
  fail,
  getAccessToken,
  pass,
} from "./tenant-verify-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const STAMP = Date.now();
const TEST_ORG_SLUG = `admin-remove-verify-${STAMP}`;
const TEST_ORG_NAME = `Admin Remove Verify ${STAMP}`;
const TEST_ORG_B_SLUG = `admin-remove-b-${STAMP}`;
const TEST_ORG_B_NAME = `Admin Remove Org B ${STAMP}`;
const PRIMARY_EMAIL = testEmail(`remove.primary.${STAMP}`);
const ADMIN_EMAIL = testEmail(`remove.admin.${STAMP}`);
const PENDING_EMAIL = testEmail(`remove.pending.${STAMP}`);
const MULTI_EMAIL = testEmail(`remove.multi.${STAMP}`);

async function findPlatformOwnerUserId(admin) {
  const { data: owner } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("active", true)
    .eq("role", "platform_owner")
    .limit(1)
    .maybeSingle();

  return owner?.user_id ?? null;
}

async function completeInvite(admin, invitationId, password) {
  const { data: invitationRow } = await admin
    .from("organization_invitations")
    .select("auth_user_id")
    .eq("id", invitationId)
    .maybeSingle();

  const userId = invitationRow?.auth_user_id ?? null;
  if (!userId) {
    throw new Error("Invitation missing auth_user_id");
  }

  await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });

  const token = await getAccessToken(admin, userId);
  const completeRes = await fetch(`${BASE}/api/invitations/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (completeRes.status !== 200) {
    throw new Error(`complete invitation failed (${completeRes.status})`);
  }

  await admin.from("user_profiles").upsert(
    {
      user_id: userId,
      account_setup_completed: true,
    },
    { onConflict: "user_id" }
  );

  return userId;
}

async function main() {
  loadEnvLocal();
  assertAuthEmailsSuppressed();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey);
  let failures = 0;
  const cleanup = [];
  let orgId = null;
  let orgBId = null;
  let propertyId = null;
  let propertyBId = null;
  let primaryInviteId = null;
  let adminInviteId = null;
  let primaryUserId = null;
  let adminUserId = null;
  let multiUserId = null;
  let tempPlatformAdminUserId = null;
  let tempPlatformAdminRowId = null;
  let historyPassOnId = null;

  pass("Administrator remove verification starting (" + BASE + ")");

  try {
    const unauth = await fetch(
      `${BASE}/api/admin/organizations/1/invitations/00000000-0000-0000-0000-000000000001`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", confirmName: "Test" }),
      }
    );
    failures +=
      unauth.status === 401
        ? pass("POST remove without auth returns 401")
        : fail("POST remove without auth returns 401", `got ${unauth.status}`);
  } catch (error) {
    failures += fail(
      "Remove endpoint reachable",
      error instanceof Error ? error.message : "fetch failed"
    );
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const platformOwnerUserId = await findPlatformOwnerUserId(admin);
  if (!platformOwnerUserId) {
    failures += fail("Load platform owner user");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const platformToken = await getAccessToken(admin, platformOwnerUserId);
  const authHeaders = {
    Authorization: `Bearer ${platformToken}`,
    "Content-Type": "application/json",
  };

  try {
    const createOrgRes = await fetch(`${BASE}/api/admin/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: TEST_ORG_NAME, slug: TEST_ORG_SLUG }),
    });
    if (createOrgRes.status !== 201) {
      failures += fail("Create remove-test organization", `got ${createOrgRes.status}`);
      throw new Error("abort");
    }
    const organization = await createOrgRes.json();
    orgId = organization.id;
    cleanup.push(async () => {
      if (orgId) await admin.from("organizations").delete().eq("id", orgId);
    });

    const propRes = await fetch(`${BASE}/api/admin/organizations/${orgId}/properties`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Remove Property A",
        address: "1 Remove Lane",
        timezone: "America/New_York",
      }),
    });
    if (propRes.status !== 201) {
      failures += fail("Create remove-test property", `got ${propRes.status}`);
      throw new Error("abort");
    }
    propertyId = (await propRes.json()).id;
    cleanup.unshift(async () => {
      if (propertyId) await admin.from("properties").delete().eq("id", propertyId);
    });

    await fetch(`${BASE}/api/admin/organizations/${orgId}/modules`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        modules: [
          "dashboard",
          "reports",
          "lost_found",
          "pass_on",
          "inspections",
          "maintenance",
          "settings",
        ].map((moduleKey) => ({ moduleKey, enabled: true })),
      }),
    });

    const primaryInviteRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          propertyId,
          email: PRIMARY_EMAIL,
          firstName: "Primary",
          lastName: "Owner",
        }),
      }
    );
    if (primaryInviteRes.status !== 201) {
      failures += fail("Invite Primary Owner", `got ${primaryInviteRes.status}`);
      throw new Error("abort");
    }
    primaryInviteId = (await primaryInviteRes.json()).id;
    primaryUserId = await completeInvite(
      admin,
      primaryInviteId,
      "RemovePrimaryPassword123!"
    );

    const adminInviteRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          propertyId,
          role: "organization_admin",
          email: ADMIN_EMAIL,
          firstName: "Removable",
          lastName: "Admin",
          propertyIds: [propertyId],
        }),
      }
    );
    if (adminInviteRes.status !== 201) {
      failures += fail("Invite removable administrator", `got ${adminInviteRes.status}`);
      throw new Error("abort");
    }
    adminInviteId = (await adminInviteRes.json()).id;
    adminUserId = await completeInvite(
      admin,
      adminInviteId,
      "RemoveAdminPassword123!"
    );

    cleanup.unshift(async () => {
      if (historyPassOnId) {
        await admin.from("pass_on_log").delete().eq("id", historyPassOnId);
      }
      await admin.from("organization_invitations").delete().eq("organization_id", orgId);
      await admin.from("team_members").delete().eq("organization_id", orgId);
      if (propertyId) {
        await admin.from("user_properties").delete().eq("property_id", propertyId);
      }
      await admin.from("organization_users").delete().eq("organization_id", orgId);
      if (adminUserId) await admin.auth.admin.deleteUser(adminUserId);
      if (primaryUserId) await admin.auth.admin.deleteUser(primaryUserId);
    });

    // Seed a historical pass-on authored by the removable admin.
    const { data: historyRow, error: historyError } = await admin
      .from("pass_on_log")
      .insert({
        organization_id: orgId,
        property_id: propertyId,
        author: "Removable Admin",
        subject: `History retention ${STAMP}`,
        message: `History retention check ${STAMP}`,
        priority: "Normal",
        entry_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .maybeSingle();

    if (historyError || !historyRow?.id) {
      failures += fail(
        "Seed historical pass-on for retention check",
        historyError?.message ?? "no id"
      );
    } else {
      historyPassOnId = historyRow.id;
      pass("Seeded historical pass-on authored by removable admin");
    }

    // Pending invitation: cancel OK, remove as accepted → 409
    const pendingInviteRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          propertyId,
          role: "property_administrator",
          email: PENDING_EMAIL,
          firstName: "Pending",
          lastName: "Invite",
        }),
      }
    );
    if (pendingInviteRes.status !== 201) {
      failures += fail("Invite pending administrator", `got ${pendingInviteRes.status}`);
    } else {
      const pendingInvitation = await pendingInviteRes.json();
      const pendingRemove = await fetch(
        `${BASE}/api/admin/organizations/${orgId}/invitations/${pendingInvitation.id}`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            action: "remove",
            confirmName: "Pending Invite",
          }),
        }
      );
      failures +=
        pendingRemove.status === 409
          ? pass("Pending invitation cannot be removed as an accepted admin")
          : fail(
              "Pending invitation cannot be removed as an accepted admin",
              `got ${pendingRemove.status}`
            );

      const pendingCancel = await fetch(
        `${BASE}/api/admin/organizations/${orgId}/invitations/${pendingInvitation.id}`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ action: "cancel" }),
        }
      );
      failures +=
        pendingCancel.status === 200
          ? pass("Pending invitation can be cancelled")
          : fail("Pending invitation can be cancelled", `got ${pendingCancel.status}`);
    }

    // Primary Owner disable/remove → 409
    const primaryDisable = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${primaryInviteId}`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "disable" }),
      }
    );
    failures +=
      primaryDisable.status === 409
        ? pass("Primary Owner disable returns 409")
        : fail("Primary Owner disable returns 409", `got ${primaryDisable.status}`);

    const primaryRemove = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${primaryInviteId}`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "remove",
          confirmName: "Primary Owner",
        }),
      }
    );
    failures +=
      primaryRemove.status === 409
        ? pass("Primary Owner remove returns 409")
        : fail("Primary Owner remove returns 409", `got ${primaryRemove.status}`);

    // Non–platform-owner SaaS admin cannot remove
    const tempEmail = testEmail(`temp.platform.admin.${STAMP}`);
    const { data: tempAuth, error: tempAuthError } =
      await admin.auth.admin.createUser({
        email: tempEmail,
        password: "TempPlatformAdminPassword123!",
        email_confirm: true,
      });
    if (tempAuthError || !tempAuth.user) {
      failures += fail(
        "Create temporary platform_admin user",
        tempAuthError?.message ?? "missing user"
      );
    } else {
      tempPlatformAdminUserId = tempAuth.user.id;
      const { data: tempRow, error: tempRowError } = await admin
        .from("platform_admins")
        .insert({
          user_id: tempPlatformAdminUserId,
          role: "platform_admin",
          active: true,
        })
        .select("id")
        .maybeSingle();

      if (tempRowError || !tempRow?.id) {
        failures += fail(
          "Insert temporary platform_admin row",
          tempRowError?.message ?? "missing id"
        );
      } else {
        tempPlatformAdminRowId = tempRow.id;
        cleanup.unshift(async () => {
          if (tempPlatformAdminRowId) {
            await admin.from("platform_admins").delete().eq("id", tempPlatformAdminRowId);
          }
          if (tempPlatformAdminUserId) {
            await admin.auth.admin.deleteUser(tempPlatformAdminUserId);
          }
        });

        const tempToken = await getAccessToken(admin, tempPlatformAdminUserId);
        const nonOwnerRemove = await fetch(
          `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInviteId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tempToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "remove",
              confirmName: "Removable Admin",
            }),
          }
        );
        failures +=
          nonOwnerRemove.status === 403
            ? pass("Non-platform-owner SaaS admin cannot remove administrators")
            : fail(
                "Non-platform-owner SaaS admin cannot remove administrators",
                `got ${nonOwnerRemove.status}`
              );
      }
    }

    // Disable / re-enable
    const disableRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInviteId}`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "disable" }),
      }
    );
    failures +=
      disableRes.status === 200
        ? pass("Platform owner can disable a non-primary admin")
        : fail(
            "Platform owner can disable a non-primary admin",
            `got ${disableRes.status}`
          );

    const adminToken = await getAccessToken(admin, adminUserId);
    const disabledDash = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-one-eyrie-property-id": String(propertyId),
      },
    });
    failures +=
      disabledDash.status === 403
        ? pass("Disabled admin receives 403 for assigned property")
        : fail(
            "Disabled admin receives 403 for assigned property",
            `got ${disabledDash.status}`
          );

    const enableRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInviteId}`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "enable" }),
      }
    );
    failures +=
      enableRes.status === 200
        ? pass("Platform owner can re-enable a non-primary admin")
        : fail(
            "Platform owner can re-enable a non-primary admin",
            `got ${enableRes.status}`
          );

    const enabledDash = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-one-eyrie-property-id": String(propertyId),
      },
    });
    failures +=
      enabledDash.status === 200
        ? pass("Re-enabled admin regains property access")
        : fail(
            "Re-enabled admin regains property access",
            `got ${enabledDash.status}`
          );

    // Confirm name mismatch rejected
    const badConfirm = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInviteId}`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "remove",
          confirmName: "Wrong Name",
        }),
      }
    );
    failures +=
      badConfirm.status === 400
        ? pass("Remove rejects mismatched typed-name confirmation")
        : fail(
            "Remove rejects mismatched typed-name confirmation",
            `got ${badConfirm.status}`
          );

    // Permanent remove
    const removeRes = await fetch(
      `${BASE}/api/admin/organizations/${orgId}/invitations/${adminInviteId}`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          action: "remove",
          confirmName: "Removable Admin",
        }),
      }
    );
    failures +=
      removeRes.status === 200
        ? pass("Platform owner can remove a non-primary admin")
        : fail(
            "Platform owner can remove a non-primary admin",
            `got ${removeRes.status}`
          );

    const { data: orgUserAfter } = await admin
      .from("organization_users")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", adminUserId)
      .maybeSingle();
    failures +=
      !orgUserAfter
        ? pass("Removed admin organization_users membership deleted")
        : fail("Removed admin organization_users membership deleted");

    const { data: propertyAfter } = await admin
      .from("user_properties")
      .select("user_id")
      .eq("user_id", adminUserId)
      .eq("property_id", propertyId)
      .maybeSingle();
    failures +=
      !propertyAfter
        ? pass("Removed admin user_properties membership deleted")
        : fail("Removed admin user_properties membership deleted");

    const { data: teamAfter } = await admin
      .from("team_members")
      .select("status, can_login")
      .eq("auth_user_id", adminUserId)
      .eq("organization_id", orgId)
      .maybeSingle();
    failures +=
      teamAfter &&
      teamAfter.status === "Inactive" &&
      teamAfter.can_login === false
        ? pass("Removed admin team_members access deactivated")
        : fail(
            "Removed admin team_members access deactivated",
            JSON.stringify(teamAfter)
          );

    const removedDash = await fetch(`${BASE}/api/dashboard`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "x-one-eyrie-property-id": String(propertyId),
      },
    });
    failures +=
      removedDash.status === 403
        ? pass("Removed admin receives 403 for former property")
        : fail(
            "Removed admin receives 403 for former property",
            `got ${removedDash.status}`
          );

    if (historyPassOnId) {
      const { data: historyStill } = await admin
        .from("pass_on_log")
        .select("id, author")
        .eq("id", historyPassOnId)
        .maybeSingle();
      failures +=
        historyStill?.id === historyPassOnId
          ? pass("Historical activity remains visible after remove")
          : fail("Historical activity remains visible after remove");
    }

    const { data: authStill } = await admin.auth.admin.getUserById(adminUserId);
    failures +=
      authStill?.user?.id === adminUserId
        ? pass("Auth user retained after organization membership removal")
        : fail("Auth user retained after organization membership removal");

    const { data: platformOwnerStill } = await admin
      .from("platform_admins")
      .select("id, active, role")
      .eq("user_id", platformOwnerUserId)
      .eq("active", true)
      .maybeSingle();
    failures +=
      platformOwnerStill?.role === "platform_owner"
        ? pass("Platform owner platform_admins row unaffected by hotel admin remove")
        : fail("Platform owner platform_admins row unaffected by hotel admin remove");

    // Multi-org isolation: same Auth user in org B remains after remove from org A path
    // Refresh platform owner token — earlier steps can run long enough to expire JWT.
    const platformTokenFresh = await getAccessToken(admin, platformOwnerUserId);
    Object.assign(authHeaders, {
      Authorization: `Bearer ${platformTokenFresh}`,
    });

    const createOrgB = await fetch(`${BASE}/api/admin/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: TEST_ORG_B_NAME, slug: TEST_ORG_B_SLUG }),
    });
    if (createOrgB.status !== 201) {
      failures += fail("Create second organization for multi-org check", `got ${createOrgB.status}`);
    } else {
      orgBId = (await createOrgB.json()).id;
      cleanup.push(async () => {
        if (orgBId) await admin.from("organizations").delete().eq("id", orgBId);
      });

      const propBRes = await fetch(
        `${BASE}/api/admin/organizations/${orgBId}/properties`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            name: "Remove Property B",
            address: "2 Remove Lane",
            timezone: "America/New_York",
          }),
        }
      );
      propertyBId = (await propBRes.json()).id;
      cleanup.unshift(async () => {
        if (propertyBId) await admin.from("properties").delete().eq("id", propertyBId);
      });

      await fetch(`${BASE}/api/admin/organizations/${orgBId}/modules`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          modules: [
            "dashboard",
            "reports",
            "lost_found",
            "pass_on",
            "inspections",
            "maintenance",
            "settings",
          ].map((moduleKey) => ({
            moduleKey,
            enabled: true,
          })),
        }),
      });

      // Primary for org B
      const orgBPrimary = await fetch(
        `${BASE}/api/admin/organizations/${orgBId}/invitations`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            propertyId: propertyBId,
            email: testEmail(`remove.b.primary.${STAMP}`),
            firstName: "OrgB",
            lastName: "Primary",
          }),
        }
      );
      const orgBPrimaryId = (await orgBPrimary.json()).id;
      const orgBPrimaryUserId = await completeInvite(
        admin,
        orgBPrimaryId,
        "RemoveOrgBPrimaryPassword123!"
      );
      cleanup.unshift(async () => {
        if (orgBPrimaryUserId) await admin.auth.admin.deleteUser(orgBPrimaryUserId);
        await admin.from("organization_invitations").delete().eq("organization_id", orgBId);
        await admin.from("team_members").delete().eq("organization_id", orgBId);
        if (propertyBId) {
          await admin.from("user_properties").delete().eq("property_id", propertyBId);
        }
        await admin.from("organization_users").delete().eq("organization_id", orgBId);
      });

      // Invite multi-org admin to org A again is already removed — invite to org A and org B
      // Create a fresh org-A secondary for multi-org: re-invite MULTI_EMAIL to org A + org B
      const multiAInvite = await fetch(
        `${BASE}/api/admin/organizations/${orgId}/invitations`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            propertyId,
            role: "property_administrator",
            email: MULTI_EMAIL,
            firstName: "Multi",
            lastName: "OrgAdmin",
          }),
        }
      );
      if (multiAInvite.status !== 201) {
        failures += fail(
          "Invite multi-org admin to org A",
          `got ${multiAInvite.status}`
        );
      } else {
        const multiA = await multiAInvite.json();
        multiUserId = await completeInvite(
          admin,
          multiA.id,
          "RemoveMultiOrgPassword123!"
        );
        cleanup.unshift(async () => {
          if (multiUserId) await admin.auth.admin.deleteUser(multiUserId);
        });

        const multiBInvite = await fetch(
          `${BASE}/api/admin/organizations/${orgBId}/invitations`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              propertyId: propertyBId,
              role: "property_administrator",
              email: MULTI_EMAIL,
              firstName: "Multi",
              lastName: "OrgAdmin",
            }),
          }
        );
        if (multiBInvite.status !== 201) {
          failures += fail(
            "Invite multi-org admin to org B",
            `got ${multiBInvite.status}`
          );
        } else {
          const multiB = await multiBInvite.json();
          // Completion for existing user may require signing in again
          const multiToken = await getAccessToken(admin, multiUserId);
          const completeB = await fetch(`${BASE}/api/invitations/complete`, {
            method: "POST",
            headers: { Authorization: `Bearer ${multiToken}` },
          });
          if (completeB.status !== 200) {
            // Fallback: mark auth link if invitation created a different user
            const linked = await completeInvite(
              admin,
              multiB.id,
              "RemoveMultiOrgPassword123!"
            );
            if (linked !== multiUserId) {
              // Prefer keeping the first user; still complete memberships via service role if needed
              await admin
                .from("organization_invitations")
                .update({
                  status: "accepted",
                  auth_user_id: multiUserId,
                  accepted_at: new Date().toISOString(),
                })
                .eq("id", multiB.id);
              await admin.from("organization_users").upsert(
                {
                  organization_id: orgBId,
                  user_id: multiUserId,
                  role: "org_member",
                  active: true,
                },
                { onConflict: "organization_id,user_id" }
              );
              await admin.from("user_properties").upsert(
                {
                  user_id: multiUserId,
                  property_id: propertyBId,
                  role: "property_admin",
                  is_default: true,
                  active: true,
                },
                { onConflict: "user_id,property_id" }
              );
            }
          }

          const removeMultiA = await fetch(
            `${BASE}/api/admin/organizations/${orgId}/invitations/${multiA.id}`,
            {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({
                action: "remove",
                confirmName: "Multi OrgAdmin",
              }),
            }
          );
          failures +=
            removeMultiA.status === 200
              ? pass("Removed multi-org admin from organization A only")
              : fail(
                  "Removed multi-org admin from organization A only",
                  `got ${removeMultiA.status}`
                );

          const multiTokenFresh = await getAccessToken(admin, multiUserId);
          const dashA = await fetch(`${BASE}/api/dashboard`, {
            headers: {
              Authorization: `Bearer ${multiTokenFresh}`,
              "x-one-eyrie-property-id": String(propertyId),
            },
          });
          failures +=
            dashA.status === 403
              ? pass("Multi-org admin loses access to removed organization")
              : fail(
                  "Multi-org admin loses access to removed organization",
                  `got ${dashA.status}`
                );

          const dashB = await fetch(`${BASE}/api/dashboard`, {
            headers: {
              Authorization: `Bearer ${multiTokenFresh}`,
              "x-one-eyrie-property-id": String(propertyBId),
            },
          });
          failures +=
            dashB.status === 200
              ? pass("Multi-org admin retains access to other organization")
              : fail(
                  "Multi-org admin retains access to other organization",
                  `got ${dashB.status}`
                );
        }
      }
    }

    // Self-target: attach platform owner as org admin on org B, refuse remove
    if (orgBId && propertyBId) {
      const { data: ownerProfile } = await admin.auth.admin.getUserById(
        platformOwnerUserId
      );
      const ownerEmail = ownerProfile?.user?.email ?? `owner.${STAMP}@oneeyrie-test.invalid`;
      const { data: selfInvite, error: selfInviteError } = await admin
        .from("organization_invitations")
        .insert({
          organization_id: orgBId,
          property_id: propertyBId,
          email: ownerEmail,
          first_name: "Platform",
          last_name: "OwnerSelf",
          job_title: "Platform Owner",
          status: "accepted",
          is_primary: false,
          org_role: "org_admin",
          property_role: "property_admin",
          auth_user_id: platformOwnerUserId,
          invited_by: platformOwnerUserId,
          accepted_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();

      if (selfInviteError || !selfInvite?.id) {
        failures += fail(
          "Seed platform owner hotel-admin membership for self-remove check",
          selfInviteError?.message ?? "missing invite"
        );
      } else {
        cleanup.unshift(async () => {
          await admin.from("organization_invitations").delete().eq("id", selfInvite.id);
          await admin
            .from("organization_users")
            .delete()
            .eq("organization_id", orgBId)
            .eq("user_id", platformOwnerUserId);
          await admin
            .from("user_properties")
            .delete()
            .eq("user_id", platformOwnerUserId)
            .eq("property_id", propertyBId);
          await admin
            .from("team_members")
            .delete()
            .eq("organization_id", orgBId)
            .eq("auth_user_id", platformOwnerUserId);
        });

        await admin.from("organization_users").upsert(
          {
            organization_id: orgBId,
            user_id: platformOwnerUserId,
            role: "org_admin",
            active: true,
          },
          { onConflict: "organization_id,user_id" }
        );
        await admin.from("user_properties").upsert(
          {
            user_id: platformOwnerUserId,
            property_id: propertyBId,
            role: "property_admin",
            is_default: true,
            active: true,
          },
          { onConflict: "user_id,property_id" }
        );

        const selfRemove = await fetch(
          `${BASE}/api/admin/organizations/${orgBId}/invitations/${selfInvite.id}`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              action: "remove",
              confirmName: "Platform OwnerSelf",
            }),
          }
        );
        failures +=
          selfRemove.status === 403
            ? pass("Platform owner cannot remove own hotel-admin record via this workflow")
            : fail(
                "Platform owner cannot remove own hotel-admin record via this workflow",
                `got ${selfRemove.status}`
              );

        const selfDisable = await fetch(
          `${BASE}/api/admin/organizations/${orgBId}/invitations/${selfInvite.id}`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ action: "disable" }),
          }
        );
        failures +=
          selfDisable.status === 403
            ? pass("Platform owner cannot disable own hotel-admin record via this workflow")
            : fail(
                "Platform owner cannot disable own hotel-admin record via this workflow",
                `got ${selfDisable.status}`
              );

        const { data: platformStill } = await admin
          .from("platform_admins")
          .select("id, active, role")
          .eq("user_id", platformOwnerUserId)
          .maybeSingle();
        failures +=
          platformStill?.active === true && platformStill?.role === "platform_owner"
            ? pass("platform_admins access not removed through administrator remove workflow")
            : fail(
                "platform_admins access not removed through administrator remove workflow"
              );
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message !== "abort") {
      failures += fail("Unexpected error", error.message);
    }
  }

  console.log(`\nFailures: ${failures}`);
  for (const undo of cleanup) {
    try {
      await undo();
    } catch {
      // Best-effort cleanup.
    }
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Platform admin portal — Stage F verification.
 *
 * Verifies first-GM invitation + membership completion.
 * Requires dev server: npm run dev (or SMOKE_BASE_URL).
 *
 * Usage: node scripts/tenant/verify-platform-admin-stage-f.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  fail,
  findTeamManagerAuthUserId,
  getAccessToken,
  pass,
} from "./tenant-verify-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const TEST_ORG_SLUG = `stage-f-verify-${Date.now()}`;
const TEST_ORG_NAME = `Stage F Verify ${Date.now()}`;
const TEST_EMAIL = `stagef.gm.${Date.now()}@gmail.com`;

async function findPlatformAdminUserId(admin) {
  const { data: owner } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("active", true)
    .eq("role", "platform_owner")
    .limit(1)
    .maybeSingle();

  if (owner?.user_id) return owner.user_id;

  const { data: anyAdmin } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  return anyAdmin?.user_id ?? null;
}

async function expectStatus(response, status, label, failures) {
  if (response.status === status) {
    pass(label);
    return failures;
  }
  return failures + fail(label, `got ${response.status}`);
}

async function main() {
  loadEnvLocal();
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
  let propertyId = null;
  let invitationId = null;
  let gmUserId = null;

  pass("Stage F verification starting (requires dev server at " + BASE + ")");

  const inviteEndpoint = "/api/admin/organizations/1/invitations";

  try {
    const unauthRes = await fetch(`${BASE}${inviteEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    failures = await expectStatus(
      unauthRes,
      401,
      "POST /api/admin/organizations/1/invitations without auth returns 401",
      failures
    );
  } catch (error) {
    failures += fail(
      "POST invitations endpoint reachable",
      error instanceof Error ? error.message : "fetch failed"
    );
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const managerUserId = await findTeamManagerAuthUserId(admin, 1, 1);
  if (!managerUserId) {
    failures += fail("Load pilot hotel user for 403 checks");
  } else {
    const hotelToken = await getAccessToken(admin, managerUserId);
    const hotelRes = await fetch(`${BASE}${inviteEndpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hotelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        propertyId: 1,
        email: "blocked@example.com",
        firstName: "Blocked",
        lastName: "User",
      }),
    });
    failures = await expectStatus(
      hotelRes,
      403,
      "POST invitations with hotel user returns 403",
      failures
    );
  }

  const completeUnauth = await fetch(`${BASE}/api/invitations/complete`, {
    method: "POST",
  });
  failures = await expectStatus(
    completeUnauth,
    401,
    "POST /api/invitations/complete without auth returns 401",
    failures
  );

  const platformUserId = await findPlatformAdminUserId(admin);
  if (!platformUserId) {
    failures += fail("Load platform admin user");
  } else {
    const platformToken = await getAccessToken(admin, platformUserId);
    const authHeaders = {
      Authorization: `Bearer ${platformToken}`,
      "Content-Type": "application/json",
    };

    const createOrgRes = await fetch(`${BASE}/api/admin/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: TEST_ORG_NAME, slug: TEST_ORG_SLUG }),
    });
    if (createOrgRes.status !== 201) {
      failures += fail("Create Stage F test organization", `got ${createOrgRes.status}`);
    } else {
      const organization = await createOrgRes.json();
      orgId = organization.id;
      cleanup.push(async () => {
        if (orgId) await admin.from("organizations").delete().eq("id", orgId);
      });

      const createPropertyRes = await fetch(
        `${BASE}/api/admin/organizations/${orgId}/properties`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            name: "Stage F Test Property",
            address: "100 Invite Lane",
          }),
        }
      );
      if (createPropertyRes.status !== 201) {
        failures += fail("Create Stage F test property", `got ${createPropertyRes.status}`);
      } else {
        const property = await createPropertyRes.json();
        propertyId = property.id;
        cleanup.unshift(async () => {
          if (propertyId) await admin.from("properties").delete().eq("id", propertyId);
        });

        const orgDetailRes = await fetch(`${BASE}/api/admin/organizations/${orgId}`, {
          headers: authHeaders,
        });
        if (orgDetailRes.status !== 200) {
          failures += fail("Reload organization detail after property create");
        } else {
          const orgDetail = await orgDetailRes.json();
          failures +=
            orgDetail.canInviteAdministrator === true
              ? pass("Organization detail exposes canInviteAdministrator=true")
              : fail("Organization detail exposes canInviteAdministrator=true");
        }

        const inviteRes = await fetch(`${BASE}/api/admin/organizations/${orgId}/invitations`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            propertyId,
            email: TEST_EMAIL,
            firstName: "Stage",
            lastName: "GM",
          }),
        });

        if (inviteRes.status !== 201) {
          const body = await inviteRes.text();
          failures += fail("POST GM invitation returns 201", `got ${inviteRes.status}: ${body}`);
        } else {
          const invitation = await inviteRes.json();
          invitationId = invitation.id;
          failures +=
            invitation.status === "pending"
              ? pass("Invitation created with pending status")
              : fail("Invitation created with pending status");

          const { data: inviteAuditRows } = await admin
            .from("admin_audit_log")
            .select("action, target_id")
            .eq("action", "invitation.created")
            .eq("target_id", invitationId)
            .order("created_at", { ascending: false })
            .limit(1);
          failures +=
            inviteAuditRows?.[0]?.action === "invitation.created"
              ? pass("invitation.created audit row written")
              : fail("invitation.created audit row written");

          const { data: invitationRow } = await admin
            .from("organization_invitations")
            .select("auth_user_id")
            .eq("id", invitationId)
            .maybeSingle();

          gmUserId = invitationRow?.auth_user_id ?? null;
          if (!gmUserId) {
            failures += fail("Invitation stores auth_user_id from Supabase invite");
          } else {
            cleanup.unshift(async () => {
              if (gmUserId) await admin.auth.admin.deleteUser(gmUserId);
            });

            await admin.auth.admin.updateUserById(gmUserId, {
              password: "StageFTestPassword123!",
              email_confirm: true,
            });

            const gmToken = await getAccessToken(admin, gmUserId);
            const completeRes = await fetch(`${BASE}/api/invitations/complete`, {
              method: "POST",
              headers: { Authorization: `Bearer ${gmToken}` },
            });
            if (completeRes.status !== 200) {
              const body = await completeRes.text();
              failures += fail("POST /api/invitations/complete returns 200", `got ${completeRes.status}: ${body}`);
            } else {
              const completeBody = await completeRes.json();
              failures +=
                completeBody.completed === true
                  ? pass("Invitation completion returns completed=true")
                  : fail("Invitation completion returns completed=true");
            }

            const { data: acceptedInvitation } = await admin
              .from("organization_invitations")
              .select("status, accepted_at")
              .eq("id", invitationId)
              .maybeSingle();
            failures +=
              acceptedInvitation?.status === "accepted" && acceptedInvitation.accepted_at
                ? pass("Invitation marked accepted in database")
                : fail("Invitation marked accepted in database");

            const { count: orgUserCount } = await admin
              .from("organization_users")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", orgId)
              .eq("user_id", gmUserId)
              .eq("role", "org_owner");
            failures +=
              orgUserCount === 1
                ? pass("organization_users org_owner membership created")
                : fail("organization_users org_owner membership created");

            const { count: propertyUserCount } = await admin
              .from("user_properties")
              .select("id", { count: "exact", head: true })
              .eq("property_id", propertyId)
              .eq("user_id", gmUserId)
              .eq("role", "property_admin");
            failures +=
              propertyUserCount === 1
                ? pass("user_properties property_admin membership created")
                : fail("user_properties property_admin membership created");

            const { count: teamMemberCount } = await admin
              .from("team_members")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", orgId)
              .eq("property_id", propertyId)
              .eq("auth_user_id", gmUserId);
            failures +=
              teamMemberCount === 1
                ? pass("team_members GM profile created")
                : fail("team_members GM profile created");

            cleanup.unshift(async () => {
              await admin
                .from("team_members")
                .delete()
                .eq("auth_user_id", gmUserId)
                .eq("organization_id", orgId);
              await admin
                .from("user_properties")
                .delete()
                .eq("user_id", gmUserId)
                .eq("property_id", propertyId);
              await admin
                .from("organization_users")
                .delete()
                .eq("user_id", gmUserId)
                .eq("organization_id", orgId);
            });

            // Multiple administrators per organization are now supported: a
            // second invitation must succeed and be a non-primary Organization
            // Admin (Primary Owner remains the first administrator).
            const secondInviteRes = await fetch(
              `${BASE}/api/admin/organizations/${orgId}/invitations`,
              {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                  propertyId,
                  role: "organization_admin",
                  email: `another.admin.${Date.now()}@gmail.com`,
                  firstName: "Another",
                  lastName: "Admin",
                }),
              }
            );

            if (secondInviteRes.status !== 201) {
              const body = await secondInviteRes.text();
              failures += fail(
                "Second administrator invitation allowed (multi-admin)",
                `got ${secondInviteRes.status}: ${body}`
              );
            } else {
              const secondInvitation = await secondInviteRes.json();
              failures +=
                secondInvitation.isPrimary === false && secondInvitation.orgRole === "org_admin"
                  ? pass("Second administrator is a non-primary Organization Admin")
                  : fail(
                      "Second administrator is a non-primary Organization Admin",
                      `isPrimary=${secondInvitation.isPrimary} orgRole=${secondInvitation.orgRole}`
                    );

              const secondUserId = secondInvitation.authUserId;
              cleanup.unshift(async () => {
                await admin
                  .from("organization_invitations")
                  .delete()
                  .eq("id", secondInvitation.id);
                if (secondUserId) await admin.auth.admin.deleteUser(secondUserId);
              });

              // Cancel the pending second invitation and confirm the lifecycle.
              const cancelRes = await fetch(
                `${BASE}/api/admin/organizations/${orgId}/invitations/${secondInvitation.id}`,
                {
                  method: "POST",
                  headers: authHeaders,
                  body: JSON.stringify({ action: "cancel" }),
                }
              );
              failures +=
                cancelRes.status === 200
                  ? pass("Pending administrator invitation can be cancelled")
                  : fail(
                      "Pending administrator invitation can be cancelled",
                      `got ${cancelRes.status}`
                    );
            }

            // The Primary Administrator is protected from removal.
            const removePrimaryRes = await fetch(
              `${BASE}/api/admin/organizations/${orgId}/invitations/${invitationId}`,
              {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ action: "remove" }),
              }
            );
            failures +=
              removePrimaryRes.status === 409
                ? pass("Primary Administrator is protected from removal")
                : fail(
                    "Primary Administrator is protected from removal",
                    `got ${removePrimaryRes.status}`
                  );
          }
        }
      }
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

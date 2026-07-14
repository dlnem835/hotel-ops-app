/**
 * Invited-user first-login account setup — verification.
 *
 * Verifies onboarding API, server-side fail-closed tenant protection, username
 * uniqueness/canonicalization, and that existing users are unaffected.
 * Requires dev server: npm run dev (or SMOKE_BASE_URL) and migration 042 applied.
 *
 * Usage: node scripts/tenant/verify-invited-account-setup.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import { assertAuthEmailsSuppressed, testEmail } from "./auth-email-guard.mjs";
import {
  fail,
  findTeamManagerAuthUserId,
  getAccessToken,
  pass,
} from "./tenant-verify-auth.mjs";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const STAMP = Date.now();
const TEST_ORG_SLUG = `acct-setup-${STAMP}`;
const TEST_ORG_NAME = `Account Setup Verify ${STAMP}`;
const TEST_EMAIL = testEmail(`acctsetup.gm.${STAMP}`);
const NEW_USERNAME = `gm.setup.${STAMP}`;
const DUP_USERNAME = `dupe.${STAMP}`;

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
  let propertyId = null;
  let invitationId = null;
  let gmUserId = null;
  let dupUserId = null;

  pass("Invited account setup verification starting (dev server at " + BASE + ")");

  // --- Unauthenticated access ---------------------------------------------
  try {
    const unauthGet = await fetch(`${BASE}/api/onboarding/account`);
    failures = await expectStatus(
      unauthGet,
      401,
      "GET /api/onboarding/account without auth returns 401",
      failures
    );
    const unauthPost = await fetch(`${BASE}/api/onboarding/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    failures = await expectStatus(
      unauthPost,
      401,
      "POST /api/onboarding/account without auth returns 401",
      failures
    );
  } catch (error) {
    failures += fail(
      "Onboarding endpoint reachable",
      error instanceof Error ? error.message : "fetch failed"
    );
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  // --- Existing user is unaffected ----------------------------------------
  const managerUserId = await findTeamManagerAuthUserId(admin, 1, 1);
  if (!managerUserId) {
    failures += fail("Load pilot hotel user");
  } else {
    const managerToken = await getAccessToken(admin, managerUserId);
    const managerHeaders = { Authorization: `Bearer ${managerToken}` };

    const stateRes = await fetch(`${BASE}/api/onboarding/account`, {
      headers: managerHeaders,
    });
    if (stateRes.status === 200) {
      const body = await stateRes.json();
      failures +=
        body.accountSetupComplete === true
          ? pass("Existing user reports accountSetupComplete=true")
          : fail("Existing user reports accountSetupComplete=true");
    } else {
      failures += fail("GET onboarding state for existing user", `got ${stateRes.status}`);
    }

    const ctxRes = await fetch(`${BASE}/api/tenant/context`, {
      headers: managerHeaders,
    });
    failures =
      ctxRes.status === 200
        ? pass("Existing user still reaches /api/tenant/context (200)") + failures
        : failures + fail("Existing user still reaches /api/tenant/context", `got ${ctxRes.status}`);
  }

  const platformUserId = await findPlatformAdminUserId(admin);
  if (!platformUserId) {
    failures += fail("Load platform admin user");
    console.log(`\nFailures: ${failures}`);
    process.exit(1);
  }

  const platformToken = await getAccessToken(admin, platformUserId);
  const authHeaders = {
    Authorization: `Bearer ${platformToken}`,
    "Content-Type": "application/json",
  };

  try {
    // --- Provision org + property + invitation (Stage F path) -------------
    const createOrgRes = await fetch(`${BASE}/api/admin/organizations`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: TEST_ORG_NAME, slug: TEST_ORG_SLUG }),
    });
    if (createOrgRes.status !== 201) {
      failures += fail("Create test organization", `got ${createOrgRes.status}`);
    } else {
      orgId = (await createOrgRes.json()).id;
      cleanup.push(async () => {
        if (orgId) await admin.from("organizations").delete().eq("id", orgId);
      });

      const createPropRes = await fetch(
        `${BASE}/api/admin/organizations/${orgId}/properties`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            name: "Account Setup Property",
            address: "1 Setup Way",
            timezone: "America/New_York",
          }),
        }
      );
      if (createPropRes.status !== 201) {
        failures += fail("Create test property", `got ${createPropRes.status}`);
      } else {
        propertyId = (await createPropRes.json()).id;
        cleanup.unshift(async () => {
          if (propertyId) await admin.from("properties").delete().eq("id", propertyId);
        });

        const inviteRes = await fetch(
          `${BASE}/api/admin/organizations/${orgId}/invitations`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              propertyId,
              email: TEST_EMAIL,
              firstName: "Setup",
              lastName: "Manager",
            }),
          }
        );
        if (inviteRes.status !== 201) {
          const body = await inviteRes.text();
          failures += fail("Create GM invitation", `got ${inviteRes.status}: ${body}`);
        } else {
          invitationId = (await inviteRes.json()).id;

          const { data: invitationRow } = await admin
            .from("organization_invitations")
            .select("auth_user_id")
            .eq("id", invitationId)
            .maybeSingle();
          gmUserId = invitationRow?.auth_user_id ?? null;

          if (!gmUserId) {
            failures += fail("Invitation stores auth_user_id");
          } else {
            cleanup.unshift(async () => {
              await admin.from("user_profiles").delete().eq("user_id", gmUserId);
              await admin.from("team_members").delete().eq("auth_user_id", gmUserId).eq("organization_id", orgId);
              await admin.from("user_properties").delete().eq("user_id", gmUserId).eq("property_id", propertyId);
              await admin.from("organization_users").delete().eq("user_id", gmUserId).eq("organization_id", orgId);
              await admin.auth.admin.deleteUser(gmUserId);
            });

            await admin.auth.admin.updateUserById(gmUserId, {
              password: "TempSetupPass123!",
              email_confirm: true,
            });

            const gmToken = await getAccessToken(admin, gmUserId);
            const gmHeaders = { Authorization: `Bearer ${gmToken}`, "Content-Type": "application/json" };

            // Complete invitation (membership) — sets incomplete profile.
            const completeRes = await fetch(`${BASE}/api/invitations/complete`, {
              method: "POST",
              headers: gmHeaders,
            });
            failures =
              completeRes.status === 200
                ? pass("Invitation completion returns 200") + failures
                : failures + fail("Invitation completion returns 200", `got ${completeRes.status}`);

            // Durable incomplete state recorded.
            const { data: profileRow } = await admin
              .from("user_profiles")
              .select("account_setup_completed")
              .eq("user_id", gmUserId)
              .maybeSingle();
            failures +=
              profileRow?.account_setup_completed === false
                ? pass("Invited user has account_setup_completed=false")
                : fail("Invited user has account_setup_completed=false");

            // Onboarding state endpoint reflects incomplete.
            const preState = await fetch(`${BASE}/api/onboarding/account`, { headers: gmHeaders });
            if (preState.status === 200) {
              const body = await preState.json();
              failures +=
                body.accountSetupComplete === false
                  ? pass("GET onboarding state: accountSetupComplete=false")
                  : fail("GET onboarding state: accountSetupComplete=false");
            } else {
              failures += fail("GET onboarding state for invited user", `got ${preState.status}`);
            }

            // Fail closed: hotel data denied while incomplete.
            const ctxBlocked = await fetch(`${BASE}/api/tenant/context`, { headers: gmHeaders });
            failures = await expectStatus(
              ctxBlocked,
              403,
              "Incomplete user blocked from /api/tenant/context (403)",
              failures
            );
            const dashBlocked = await fetch(`${BASE}/api/dashboard`, { headers: gmHeaders });
            failures = await expectStatus(
              dashBlocked,
              403,
              "Incomplete user blocked from /api/dashboard (403)",
              failures
            );

            // Invalid username rejected.
            const badUsername = await fetch(`${BASE}/api/onboarding/account`, {
              method: "POST",
              headers: gmHeaders,
              body: JSON.stringify({ firstName: "Setup", lastName: "Manager", username: "ab", appearance: "dark" }),
            });
            failures = await expectStatus(
              badUsername,
              400,
              "POST setup with too-short username returns 400",
              failures
            );

            // Duplicate username rejected (seed another profile first).
            const { data: dupUser } = await admin.auth.admin.createUser({
              email: testEmail(`dupe.${STAMP}`),
              email_confirm: true,
            });
            dupUserId = dupUser?.user?.id ?? null;
            if (dupUserId) {
              cleanup.unshift(async () => {
                await admin.from("user_profiles").delete().eq("user_id", dupUserId);
                await admin.auth.admin.deleteUser(dupUserId);
              });
              await admin.from("user_profiles").insert({
                user_id: dupUserId,
                username: DUP_USERNAME,
                username_normalized: DUP_USERNAME,
                account_setup_completed: true,
                appearance_preference: "dark",
              });

              const dupRes = await fetch(`${BASE}/api/onboarding/account`, {
                method: "POST",
                headers: gmHeaders,
                body: JSON.stringify({ firstName: "Setup", lastName: "Manager", username: DUP_USERNAME, appearance: "dark" }),
              });
              failures = await expectStatus(
                dupRes,
                409,
                "POST setup with duplicate username returns 409",
                failures
              );
            }

            // Successful setup.
            const okRes = await fetch(`${BASE}/api/onboarding/account`, {
              method: "POST",
              headers: gmHeaders,
              body: JSON.stringify({ firstName: "Setup", lastName: "Manager", username: NEW_USERNAME, appearance: "dark" }),
            });
            if (okRes.status !== 200) {
              const body = await okRes.text();
              failures += fail("POST setup returns 200", `got ${okRes.status}: ${body}`);
            } else {
              pass("POST setup returns 200");

              const { data: doneProfile } = await admin
                .from("user_profiles")
                .select("account_setup_completed, username_normalized, appearance_preference")
                .eq("user_id", gmUserId)
                .maybeSingle();
              failures +=
                doneProfile?.account_setup_completed === true
                  ? pass("account_setup_completed flipped to true")
                  : fail("account_setup_completed flipped to true");
              failures +=
                doneProfile?.username_normalized === NEW_USERNAME
                  ? pass("username_normalized persisted")
                  : fail("username_normalized persisted");

              const { data: tmRow } = await admin
                .from("team_members")
                .select("username")
                .eq("auth_user_id", gmUserId)
                .maybeSingle();
              failures +=
                tmRow?.username === NEW_USERNAME
                  ? pass("team_members.username updated")
                  : fail("team_members.username updated");

              // Username login compatibility: auth email canonicalized.
              const { data: authUser } = await admin.auth.admin.getUserById(gmUserId);
              failures +=
                authUser?.user?.email === `${NEW_USERNAME}@oneeyrie.local`
                  ? pass("Auth email canonicalized to <username>@oneeyrie.local")
                  : fail("Auth email canonicalized", authUser?.user?.email);

              // Now hotel data is allowed (fetch a fresh token post-email-change).
              const gmToken2 = await getAccessToken(admin, gmUserId);
              const ctxOk = await fetch(`${BASE}/api/tenant/context`, {
                headers: { Authorization: `Bearer ${gmToken2}` },
              });
              failures = await expectStatus(
                ctxOk,
                200,
                "Completed user now reaches /api/tenant/context (200)",
                failures
              );
            }
          }
        }
      }
    }
  } catch (error) {
    failures += fail("Setup flow", error instanceof Error ? error.message : String(error));
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

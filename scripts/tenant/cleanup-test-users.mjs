/**
 * Removes verification-script test artifacts (test users, test invitations,
 * their memberships/profiles) that were created before auth-email suppression
 * existed — the source of the bounced-email traffic.
 *
 * SAFETY: only rows whose email matches strict, script-only patterns
 * (see auth-email-guard.mjs) are ever touched. Real administrator, hotel user,
 * invitation and membership data never matches these patterns and is left
 * untouched. Run with --apply to perform deletions; defaults to a dry run.
 *
 * Usage:
 *   node scripts/tenant/cleanup-test-users.mjs            # dry run (report only)
 *   node scripts/tenant/cleanup-test-users.mjs --apply    # perform cleanup
 */

import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import { isTestEmail, TEST_EMAIL_DOMAIN } from "./auth-email-guard.mjs";

const APPLY = process.argv.includes("--apply");

async function listAllAuthUsers(admin) {
  const users = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey);

  console.log(
    `${APPLY ? "APPLYING" : "DRY RUN"} — test-user cleanup (test domain: @${TEST_EMAIL_DOMAIN})\n`
  );

  // --- Test auth users --------------------------------------------------------
  const allUsers = await listAllAuthUsers(admin);
  const testUsers = allUsers.filter((u) => isTestEmail(u.email));

  // --- Test invitations (may include orphans without an auth user) ------------
  const { data: invitationRows, error: inviteErr } = await admin
    .from("organization_invitations")
    .select("id, email, auth_user_id");
  if (inviteErr) throw new Error(inviteErr.message);
  const testInvitations = (invitationRows ?? []).filter((row) => isTestEmail(row.email));

  console.log(`Test auth users found:   ${testUsers.length}`);
  for (const u of testUsers) console.log(`  - ${u.email} (${u.id})`);
  console.log(`Test invitations found:  ${testInvitations.length}`);
  for (const inv of testInvitations) console.log(`  - ${inv.email} (invitation ${inv.id})`);
  console.log("");

  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply to delete the above artifacts.");
    process.exit(0);
  }

  const userIds = new Set(testUsers.map((u) => u.id));
  for (const inv of testInvitations) {
    if (inv.auth_user_id) userIds.add(inv.auth_user_id);
  }

  let removed = 0;

  // Delete invitations first (child of organizations, references email/user).
  for (const inv of testInvitations) {
    const { error } = await admin.from("organization_invitations").delete().eq("id", inv.id);
    if (error) console.warn(`  ! invitation ${inv.id}: ${error.message}`);
  }

  // Purge memberships / profile rows keyed by the test auth user id, then the
  // auth user itself. Scoped strictly to identified test users.
  for (const userId of userIds) {
    // Invitations may reference the user even after email canonicalization.
    const { error: invByUserErr } = await admin
      .from("organization_invitations")
      .delete()
      .eq("auth_user_id", userId);
    if (invByUserErr) console.warn(`  ! invitations for ${userId}: ${invByUserErr.message}`);

    for (const table of [
      "user_profiles",
      "user_properties",
      "organization_users",
      "pass_on_log_views",
    ]) {
      const col = table === "pass_on_log_views" ? "auth_user_id" : "user_id";
      const { error } = await admin.from(table).delete().eq(col, userId);
      if (error && !/does not exist/i.test(error.message)) {
        console.warn(`  ! ${table} for ${userId}: ${error.message}`);
      }
    }
    const { error: tmError } = await admin
      .from("team_members")
      .delete()
      .eq("auth_user_id", userId);
    if (tmError) console.warn(`  ! team_members for ${userId}: ${tmError.message}`);

    // Test-script runs may have written audit rows with the invited user as actor
    // (e.g. invitation completion). Safe to remove only for identified test users.
    const { error: auditErr } = await admin
      .from("admin_audit_log")
      .delete()
      .eq("actor_user_id", userId);
    if (auditErr) console.warn(`  ! admin_audit_log for ${userId}: ${auditErr.message}`);

    const { error: delError } = await admin.auth.admin.deleteUser(userId);
    if (delError) {
      console.warn(`  ! deleteUser ${userId}: ${delError.message}`);
    } else {
      removed += 1;
    }
  }

  console.log(`\nCleanup complete. Removed ${removed} test auth user(s) and ${testInvitations.length} test invitation(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

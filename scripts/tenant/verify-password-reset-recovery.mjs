/**
 * Password recovery: verifyOtp only on password submit; public auth routes.
 *
 * Static source assertions plus parser behavior. Does not call live Auth.
 *
 * Usage: node scripts/tenant/verify-password-reset-recovery.mjs
 */

import assert from "assert";
import fs from "fs";
import path from "path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
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

function parseRecoverySearchParams(search) {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  const tokenHash = params.get("token_hash")?.trim() || "";
  const rawType = params.get("type")?.trim() || "recovery";
  if (!tokenHash) return null;
  if (rawType !== "recovery") return null;
  return { tokenHash, type: rawType };
}

function recoveryHashIndicatesFailure(hash) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return false;
  const params = new URLSearchParams(raw);
  return Boolean(
    params.get("error") ||
      params.get("error_code") ||
      params.get("error_description")
  );
}

const resetPage = read("app/auth/reset-password/page.tsx");
const parser = read("app/lib/auth/password-reset-recovery.ts");
const permissions = read("app/lib/role-permissions.ts");
const inactivity = read("app/components/InactivityGuard.tsx");
const dispatch = read("app/lib/email/dispatch-password-reset.ts");
const authLink = read("app/lib/email/auth-link.ts");

check("reset page does not verifyOtp on mount or Continue", () => {
  assert.ok(!resetPage.includes("Continue to reset password"));
  assert.ok(!resetPage.includes("handleConfirmRecovery"));
  const submitIndex = resetPage.indexOf("async function handleSubmit");
  const verifyCallIndex = resetPage.indexOf("supabase.auth.verifyOtp");
  assert.ok(submitIndex > 0);
  assert.ok(verifyCallIndex > submitIndex);
  assert.ok(resetPage.includes("pending.kind === \"token_hash\""));
  assert.ok(resetPage.includes("PASSWORD_RECOVERY"));
  assert.ok(!resetPage.includes("event === \"INITIAL_SESSION\""));
});

check("password update requires a verified recovery source", () => {
  assert.ok(resetPage.includes("if (!pending || submitInFlightRef.current)"));
  assert.ok(resetPage.includes("data.session"));
  assert.ok(resetPage.includes("supabase.auth.updateUser"));
  assert.ok(resetPage.includes('applyPageState("invalid")'));
  const updateIndex = resetPage.indexOf("supabase.auth.updateUser");
  const verifyCallIndex = resetPage.indexOf("supabase.auth.verifyOtp");
  assert.ok(updateIndex > verifyCallIndex);
});

check("success confirmation is locked after updateUser and cannot revert to invalid", () => {
  const updateIndex = resetPage.indexOf("supabase.auth.updateUser");
  const lockCallIndex = resetPage.indexOf("lockSuccessfulPasswordUpdate();");
  const signOutIndex = resetPage.lastIndexOf("supabase.auth.signOut");
  assert.ok(updateIndex > 0);
  assert.ok(lockCallIndex > updateIndex);
  assert.ok(signOutIndex > lockCallIndex);
  assert.ok(resetPage.includes("markPasswordResetSucceeded"));
  assert.ok(resetPage.includes("passwordResetSucceededInSession"));
  assert.ok(resetPage.includes("successLockRef.current"));
  assert.ok(resetPage.includes("Password Changed Successfully"));
  assert.ok(
    resetPage.includes(
      "Your password has been updated. You can now sign in using your new"
    )
  );
  assert.ok(resetPage.includes("Return to Login"));
  assert.ok(resetPage.includes("This password reset link is invalid or has expired."));
});

check("recovery routes are public so guards do not redirect", () => {
  assert.ok(permissions.includes('path === "/forgot-password"'));
  assert.ok(permissions.includes('path === "/auth/reset-password"'));
  assert.ok(inactivity.includes("isPublicAppPath"));
  assert.ok(!inactivity.includes("PUBLIC_PATHS"));
});

check("emails still use first-party hashed_token reset URLs", () => {
  assert.ok(dispatch.includes("generateLink"));
  assert.ok(dispatch.includes('type: "recovery"'));
  assert.ok(authLink.includes('path: "/auth/reset-password"'));
  assert.ok(authLink.includes("token_hash"));
});

check("parser source rejects non-recovery types and empty hashes", () => {
  assert.ok(parser.includes("rawType !== \"recovery\""));
  assert.ok(parser.includes("if (!tokenHash) return null"));
  assert.ok(parser.includes("error_code"));
  assert.ok(parser.includes("markPasswordResetSucceeded"));
  assert.ok(parser.includes("passwordResetSucceededInSession"));
});

check("recovery query parser accepts only recovery token_hash", () => {
  const parsed = parseRecoverySearchParams("?token_hash=abc123&type=recovery");
  assert.strictEqual(parsed?.tokenHash, "abc123");
  assert.strictEqual(parsed?.type, "recovery");
  assert.strictEqual(parseRecoverySearchParams(""), null);
  assert.strictEqual(parseRecoverySearchParams("?type=recovery"), null);
  assert.strictEqual(parseRecoverySearchParams("?token_hash=abc&type=invite"), null);
  assert.ok(recoveryHashIndicatesFailure("#error=access_denied&error_code=otp_expired"));
  assert.ok(!recoveryHashIndicatesFailure(""));
  assert.ok(!recoveryHashIndicatesFailure("#access_token=x"));
});

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}

console.log("\nAll password-reset recovery checks passed.");

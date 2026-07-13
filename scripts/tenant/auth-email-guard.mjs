/**
 * Shared guard + conventions for verification scripts that exercise the
 * invitation / password-reset flows, so automated tests can never generate
 * bounced-email traffic through Supabase's shared email service.
 *
 * Test email addresses use the reserved `.invalid` TLD (RFC 2606), which can
 * never resolve or be delivered — so even a mistaken real send cannot produce a
 * remote bounce against the project's sending reputation.
 */

/** Reserved, non-deliverable domain for all script-generated test accounts. */
export const TEST_EMAIL_DOMAIN = "oneeyrie-test.invalid";

/** Builds an identifiable, non-deliverable test email address. */
export function testEmail(localPart) {
  return `${localPart}@${TEST_EMAIL_DOMAIN}`;
}

/**
 * Strict patterns identifying addresses created ONLY by verification scripts.
 * Used by cleanup tooling. These never match real administrator/hotel emails.
 */
export const TEST_EMAIL_PATTERNS = [
  new RegExp(`@${TEST_EMAIL_DOMAIN.replace(/\./g, "\\.")}$`, "i"),
  /^stagef\.gm\.\d+@/i,
  /^another\.admin\.\d+@/i,
  /^acctsetup\.gm\.\d+@/i,
  /^dupe\.\d+@/i,
  /^blocked@example\.com$/i,
];

/** Whether an email address is a clearly-identified verification-script test address. */
export function isTestEmail(email) {
  if (!email) return false;
  return TEST_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}

/** Reads SUPPRESS_AUTH_EMAILS from the environment (loaded from .env.local). */
export function authEmailsSuppressed() {
  const raw = (process.env.SUPPRESS_AUTH_EMAILS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Refuses to proceed unless auth-email suppression is enabled. This guarantees a
 * verification run cannot send a real invitation / reset email (and therefore
 * cannot bounce). Because the dev server and these scripts share `.env.local`,
 * seeing the flag here means the server is also suppressing sends via
 * `generateLink`.
 */
export function assertAuthEmailsSuppressed() {
  if (authEmailsSuppressed()) return;

  console.error(
    [
      "",
      "REFUSING TO RUN: auth-email suppression is not enabled.",
      "",
      "This verification script creates invitations, which would otherwise send",
      "real emails through Supabase and risk bounced-email traffic.",
      "",
      "Set the following in .env.local (development only) and restart the dev",
      "server, then re-run:",
      "",
      "    SUPPRESS_AUTH_EMAILS=true",
      "",
      "Suppression is automatically ignored in production (NODE_ENV=production),",
      "so live deployments always send real emails.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

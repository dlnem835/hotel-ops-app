/**
 * Server-only transactional email / auth URL configuration.
 * Prefer AUTH_EMAIL_FROM + SUPPORT_EMAIL + NEXT_PUBLIC_APP_URL.
 */

export type AuthEmailConfig = {
  resendApiKey: string;
  from: string;
  supportEmail: string;
  replyTo: string;
  appUrl: string;
};

export type AuthEmailConfigResult =
  | { ok: true; config: AuthEmailConfig }
  | { ok: false; missing: string[] };

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** Public app origin for recovery redirects and email asset URLs. */
export function resolveAppUrl(): string {
  const raw =
    readEnv("NEXT_PUBLIC_APP_URL") ||
    readEnv("NEXT_PUBLIC_SITE_URL") ||
    readEnv("SMOKE_BASE_URL") ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function resolvePasswordResetRedirectUrl(): string {
  return `${resolveAppUrl()}/auth/reset-password`;
}

/**
 * Validates Resend + From + Support + App URL for branded auth emails.
 * Does not throw — callers decide how to respond to the client.
 */
export function resolveAuthEmailConfig(): AuthEmailConfigResult {
  const missing: string[] = [];

  const resendApiKey = readEnv("RESEND_API_KEY");
  if (!resendApiKey) missing.push("RESEND_API_KEY");

  const from =
    readEnv("AUTH_EMAIL_FROM") || "One Eyrie <noreply@oneeyrie.com>";
  if (!readEnv("AUTH_EMAIL_FROM")) {
    // Prefer explicit env; still allow default but warn via missing if empty after default? No — default is fine.
  }
  if (!from.includes("@")) missing.push("AUTH_EMAIL_FROM");

  const supportEmail = readEnv("SUPPORT_EMAIL") || "support@oneeyrie.com";
  if (!supportEmail.includes("@")) missing.push("SUPPORT_EMAIL");

  const appUrl = resolveAppUrl();
  if (!appUrl.startsWith("http://") && !appUrl.startsWith("https://")) {
    missing.push("NEXT_PUBLIC_APP_URL");
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    config: {
      resendApiKey,
      from,
      supportEmail,
      replyTo: supportEmail,
      appUrl,
    },
  };
}

export function logAuthEmailConfigError(missing: string[]): void {
  console.error(
    "[auth-email] Missing or invalid configuration:",
    missing.join(", ")
  );
}

/** Safe recipient domain for logs (never the full address if local-part is sensitive). */
export function recipientDomainForLog(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "(invalid)";
  return email.slice(at + 1).toLowerCase();
}

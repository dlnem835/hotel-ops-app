import "server-only";

/**
 * Stripe Checkout environment helpers.
 * Never import from client components. Never expose secret values.
 */

export type StripeEnvIssue = {
  key: string;
  message: string;
};

export type StripeCheckoutMode = "test" | "live";

export type StripeCheckoutUnavailableReason =
  | "missing_secret"
  | "invalid_secret_format";

export type StripeCheckoutStatus = {
  available: boolean;
  /** Present only when a valid secret is configured. */
  mode: StripeCheckoutMode | null;
  /** Present only when checkout is unavailable — safe for clients/logs. */
  reason: StripeCheckoutUnavailableReason | null;
};

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function classifySecret(secret: string): {
  mode: StripeCheckoutMode | null;
  reason: StripeCheckoutUnavailableReason | null;
} {
  if (!secret) {
    return { mode: null, reason: "missing_secret" };
  }
  if (secret.startsWith("sk_test_")) {
    return { mode: "test", reason: null };
  }
  if (secret.startsWith("sk_live_")) {
    return { mode: "live", reason: null };
  }
  return { mode: null, reason: "invalid_secret_format" };
}

/** Safe snapshot for API responses and server logs — never includes secret values. */
export function getStripeCheckoutStatus(): StripeCheckoutStatus {
  const { mode, reason } = classifySecret(readEnv("STRIPE_SECRET_KEY"));
  return {
    available: reason == null,
    mode,
    reason,
  };
}

/** Required to create Checkout Sessions. Accepts test or live secret keys. */
export function validateStripeCheckoutEnv(): StripeEnvIssue[] {
  const issues: StripeEnvIssue[] = [];
  const status = getStripeCheckoutStatus();
  if (status.reason === "missing_secret") {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      message:
        "Required for Stripe Checkout (set sk_test_… or sk_live_… in the deployment environment).",
    });
  } else if (status.reason === "invalid_secret_format") {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      message:
        "Unexpected Stripe secret format. Expected sk_test_… or sk_live_…",
    });
  }
  return issues;
}

/** Required to verify webhooks (C2). */
export function validateStripeWebhookEnv(): StripeEnvIssue[] {
  const issues: StripeEnvIssue[] = [];
  const webhook = readEnv("STRIPE_WEBHOOK_SECRET");
  if (!webhook) {
    issues.push({
      key: "STRIPE_WEBHOOK_SECRET",
      message:
        "Required to verify Stripe webhooks (whsec_… from Stripe CLI or Dashboard).",
    });
  } else if (!webhook.startsWith("whsec_")) {
    issues.push({
      key: "STRIPE_WEBHOOK_SECRET",
      message: "Unexpected webhook secret format. Expected whsec_…",
    });
  }
  return issues;
}

export function assertStripeCheckoutEnvReady(): void {
  const issues = validateStripeCheckoutEnv();
  if (issues.length === 0) return;
  throw new Error(
    `Stripe Checkout env invalid:\n${issues
      .map((issue) => `- ${issue.key}: ${issue.message}`)
      .join("\n")}`
  );
}

/** Safe boolean for API responses — never exposes secret values. */
export function isStripeCheckoutEnvReady(): boolean {
  return getStripeCheckoutStatus().available;
}

let loggedCheckoutUnavailable = false;

/**
 * Safe fields for guest shipping API responses.
 * Includes mode/reason so redeploys cannot fail silently without a diagnosable cause.
 */
export function getStripeCheckoutPublicFields(): {
  checkoutAvailable: boolean;
  checkoutMode: StripeCheckoutMode | null;
  checkoutUnavailableReason: StripeCheckoutUnavailableReason | null;
} {
  const status = getStripeCheckoutStatus();
  if (!status.available && !loggedCheckoutUnavailable) {
    loggedCheckoutUnavailable = true;
    console.warn("[stripe-checkout] unavailable", {
      reason: status.reason,
      vercelEnv: process.env.VERCEL_ENV || null,
    });
  }
  return {
    checkoutAvailable: status.available,
    checkoutMode: status.mode,
    checkoutUnavailableReason: status.reason,
  };
}

export function getStripeSecretKey(): string {
  assertStripeCheckoutEnvReady();
  return readEnv("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret(): string {
  const issues = validateStripeWebhookEnv();
  if (issues.length > 0) {
    throw new Error(
      `Stripe webhook env invalid:\n${issues
        .map((issue) => `- ${issue.key}: ${issue.message}`)
        .join("\n")}`
    );
  }
  return readEnv("STRIPE_WEBHOOK_SECRET");
}

/**
 * Optional — Checkout uses server-created session URLs; publishable key not required.
 * When set, mode should match the secret (test/live); mismatch is logged, not a hard fail.
 */
export function getStripePublishableKey(): string | null {
  const key = readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  if (!key) return null;
  const status = getStripeCheckoutStatus();
  if (key.startsWith("pk_live_")) {
    if (status.mode === "test") {
      console.warn(
        "[stripe-checkout] publishable key is live but secret is test"
      );
    }
    return key;
  }
  if (key.startsWith("pk_test_")) {
    if (status.mode === "live") {
      console.warn(
        "[stripe-checkout] publishable key is test but secret is live"
      );
    }
    return key;
  }
  throw new Error(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be pk_test_… or pk_live_… when set."
  );
}

import "server-only";

/**
 * Stripe test-mode environment helpers (Checkpoint C).
 * Never import from client components.
 */

export type StripeEnvIssue = {
  key: string;
  message: string;
};

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/** Required to create Checkout Sessions (C1). */
export function validateStripeCheckoutEnv(): StripeEnvIssue[] {
  const issues: StripeEnvIssue[] = [];
  const secret = readEnv("STRIPE_SECRET_KEY");
  if (!secret) {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      message: "Required for Stripe Checkout (use sk_test_… for test mode).",
    });
  } else if (secret.startsWith("sk_live_")) {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      message:
        "Live Stripe key detected. Checkpoint C requires test mode (sk_test_…). Refusing to start.",
    });
  } else if (!secret.startsWith("sk_test_")) {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      message: "Unexpected Stripe secret format. Expected sk_test_… for Checkpoint C.",
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
  return validateStripeCheckoutEnv().length === 0;
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

/** Optional — Checkout uses server-created session URLs; publishable key not required for C1. */
export function getStripePublishableKey(): string | null {
  const key = readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  if (!key) return null;
  if (key.startsWith("pk_live_")) {
    throw new Error(
      "Live Stripe publishable key is not allowed in Checkpoint C. Use pk_test_… only."
    );
  }
  if (!key.startsWith("pk_test_")) {
    throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be pk_test_… when set.");
  }
  return key;
}

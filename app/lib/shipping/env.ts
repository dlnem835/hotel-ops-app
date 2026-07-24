/**
 * Server-only shipping / payment environment validation (Phase 2).
 * Never import this module from client components.
 */

export type ShippingProviderMode = "mock" | "shippo";

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function getShippingProviderMode(): ShippingProviderMode {
  const value = (readEnv("SHIPPING_PROVIDER") || "mock").toLowerCase();
  return value === "shippo" ? "shippo" : "mock";
}

export function getAppBaseUrl(): string {
  const raw =
    readEnv("NEXT_PUBLIC_APP_URL") ||
    readEnv("APP_BASE_URL") ||
    readEnv("NEXT_PUBLIC_SITE_URL") ||
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export type ShippingEnvIssue = {
  key: string;
  message: string;
};

/** Validates env for the currently selected shipping provider mode. */
export function validateShippingProviderEnv(
  mode: ShippingProviderMode = getShippingProviderMode()
): ShippingEnvIssue[] {
  const issues: ShippingEnvIssue[] = [];

  if (mode === "shippo") {
    const token = readEnv("SHIPPO_API_TOKEN");
    if (!token) {
      issues.push({
        key: "SHIPPO_API_TOKEN",
        message: "Required when SHIPPING_PROVIDER=shippo (use shippo_test_… for test mode).",
      });
    } else if (!token.startsWith("shippo_test_") && !token.startsWith("shippo_live_")) {
      issues.push({
        key: "SHIPPO_API_TOKEN",
        message: "Unexpected Shippo token format. Expected shippo_test_… or shippo_live_…",
      });
    } else if (token.startsWith("shippo_live_")) {
      issues.push({
        key: "SHIPPO_API_TOKEN",
        message:
          "Live Shippo token detected. Phase 2 requires test mode (shippo_test_…). Refusing to start.",
      });
    }
  }

  return issues;
}

/** Validates Stripe test-mode env (Checkpoint C will require these at runtime). */
export function validateStripeTestEnv(): ShippingEnvIssue[] {
  const issues: ShippingEnvIssue[] = [];
  const secret = readEnv("STRIPE_SECRET_KEY");
  if (!secret) {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      message: "Required for Stripe Checkout (use sk_test_… for test mode).",
    });
  } else if (secret.startsWith("sk_live_")) {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      message: "Live Stripe key detected. Phase 2 requires test mode (sk_test_…). Refusing to start.",
    });
  } else if (!secret.startsWith("sk_test_")) {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      message: "Unexpected Stripe secret format. Expected sk_test_… for Phase 2.",
    });
  }

  const webhook = readEnv("STRIPE_WEBHOOK_SECRET");
  if (!webhook) {
    issues.push({
      key: "STRIPE_WEBHOOK_SECRET",
      message: "Required to verify Stripe webhooks (whsec_… from Stripe CLI or Dashboard).",
    });
  }

  return issues;
}

export function assertShippingProviderEnvReady(
  mode: ShippingProviderMode = getShippingProviderMode()
): void {
  const issues = validateShippingProviderEnv(mode);
  if (issues.length === 0) return;
  throw new Error(
    `Shipping provider env invalid:\n${issues
      .map((issue) => `- ${issue.key}: ${issue.message}`)
      .join("\n")}`
  );
}

export function getShippoApiToken(): string {
  assertShippingProviderEnvReady("shippo");
  return readEnv("SHIPPO_API_TOKEN");
}

export function getShippoWebhookSecret(): string | null {
  const value = readEnv("SHIPPO_WEBHOOK_SECRET");
  return value || null;
}

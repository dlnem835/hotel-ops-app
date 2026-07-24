import "server-only";

import Stripe from "stripe";

/**
 * Server-only Stripe client. Phase 2 Checkpoint A: client construction + test-mode guard.
 * Checkout/webhooks are Checkpoint C.
 */

function readStripeSecret(): string {
  const secret = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  if (secret.startsWith("sk_live_")) {
    throw new Error(
      "Live Stripe secret key is not allowed in Phase 2. Use sk_test_… only."
    );
  }
  if (!secret.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY must be a test key (sk_test_…).");
  }
  return secret;
}

let cached: Stripe | null = null;

export function getStripeServerClient(): Stripe {
  if (cached) return cached;
  cached = new Stripe(readStripeSecret());
  return cached;
}

/** Safe for logs — never returns the secret. */
export function getStripeModeLabel(): "test" | "unconfigured" | "blocked_live" {
  const secret = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!secret) return "unconfigured";
  if (secret.startsWith("sk_live_")) return "blocked_live";
  if (secret.startsWith("sk_test_")) return "test";
  return "unconfigured";
}

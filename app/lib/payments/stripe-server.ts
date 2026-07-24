import "server-only";

import Stripe from "stripe";
import { getStripeSecretKey } from "@/app/lib/payments/stripe-env";

/**
 * Server-only Stripe client — test mode only.
 */

let cached: Stripe | null = null;

export function getStripeServerClient(): Stripe {
  if (cached) return cached;
  cached = new Stripe(getStripeSecretKey(), {
    typescript: true,
  });
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

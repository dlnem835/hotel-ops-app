import "server-only";

import Stripe from "stripe";
import {
  getStripeCheckoutStatus,
  getStripeSecretKey,
  type StripeCheckoutMode,
} from "@/app/lib/payments/stripe-env";

/**
 * Server-only Stripe client (test or live, based on STRIPE_SECRET_KEY).
 */

let cached: Stripe | null = null;
let cachedSecret: string | null = null;

export function getStripeServerClient(): Stripe {
  const secret = getStripeSecretKey();
  if (cached && cachedSecret === secret) return cached;
  cached = new Stripe(secret, {
    typescript: true,
  });
  cachedSecret = secret;
  return cached;
}

/** Safe for logs — never returns the secret. */
export function getStripeModeLabel(): StripeCheckoutMode | "unconfigured" {
  return getStripeCheckoutStatus().mode ?? "unconfigured";
}

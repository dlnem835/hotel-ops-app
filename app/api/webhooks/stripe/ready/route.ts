import { NextResponse } from "next/server";
import { getStripeCheckoutStatus } from "@/app/lib/payments/stripe-env";
import { getShippingProviderMode } from "@/app/lib/shipping/env";
import { validateShippingProviderEnv } from "@/app/lib/shipping/env";

export const runtime = "nodejs";

/**
 * Safe readiness probe for Stripe webhook + shipping fulfillment env.
 * Does not expose secrets. Useful to confirm Production is wired after deploy.
 */
export async function GET() {
  const stripe = getStripeCheckoutStatus();
  const webhookSecret = Boolean(
    (process.env.STRIPE_WEBHOOK_SECRET || "").trim().startsWith("whsec_")
  );
  const shippingMode = getShippingProviderMode();
  const shippingIssues = validateShippingProviderEnv(shippingMode);

  return NextResponse.json({
    ok: stripe.available && webhookSecret && shippingIssues.length === 0,
    stripe: {
      checkoutAvailable: stripe.available,
      mode: stripe.mode,
      webhookSecretConfigured: webhookSecret,
    },
    shipping: {
      provider: shippingMode,
      ready: shippingIssues.length === 0,
      issueKeys: shippingIssues.map((issue) => issue.key),
    },
    vercelEnv: process.env.VERCEL_ENV || null,
    hint:
      "POST /api/webhooks/stripe with a valid Stripe-Signature to process checkout.session.completed.",
  });
}

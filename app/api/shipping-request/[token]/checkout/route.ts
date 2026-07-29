import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consumeCheckoutRateLimit } from "@/app/lib/payments/checkout-rate-limit";
import {
  createOrReuseShippingCheckoutSession,
  ShippingCheckoutError,
} from "@/app/lib/payments/create-shipping-checkout";
import { redactCheckoutSecrets } from "@/app/lib/payments/checkout-error-message";
import { hashShippingGuestToken } from "@/app/lib/lost-found-shipping/token";

type RouteContext = { params: Promise<{ token: string }> };

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Guest Checkout Session creation (Checkpoint C1).
 * Amount is read only from the server-stored shipping request — never from the body.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const tokenHash = hashShippingGuestToken(String(token || "").trim());
    const forwarded = request.headers.get("x-forwarded-for") || "";
    const ip = forwarded.split(",")[0]?.trim() || "unknown";
    const rate = consumeCheckoutRateLimit(`${tokenHash}:${ip}`);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "Too many checkout attempts. Please wait and try again.",
          code: "rate_limited",
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        }
      );
    }

    const supabase = getServiceClient();
    const result = await createOrReuseShippingCheckoutSession(supabase, token);

    if (result.alreadyPaid) {
      return NextResponse.json({
        alreadyPaid: true,
        checkoutUrl: null,
        redirectTo: `/shipping-request/${encodeURIComponent(token)}/payment-processing`,
      });
    }

    if (!result.checkoutUrl) {
      return NextResponse.json(
        {
          error: "Stripe Checkout did not return a redirect URL.",
          code: "missing_checkout_url",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      alreadyPaid: false,
      reused: result.reused,
      checkoutUrl: result.checkoutUrl,
    });
  } catch (error: unknown) {
    if (error instanceof ShippingCheckoutError) {
      console.error("[checkout]", error.code, error.message);
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }

    const raw =
      error instanceof Error ? error.message : "Unable to start checkout";
    const safe = redactCheckoutSecrets(raw) || "Unable to start secure checkout.";
    console.error("[checkout] unexpected", safe);
    return NextResponse.json(
      { error: safe, code: "checkout_error" },
      { status: 500 }
    );
  }
}

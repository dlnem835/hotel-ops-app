import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordCheckoutCancelled } from "@/app/lib/payments/create-shipping-checkout";

type RouteContext = { params: Promise<{ token: string }> };

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Record that the guest cancelled Stripe Checkout (append-only timeline). */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const supabase = getServiceClient();
    await recordCheckoutCancelled(supabase, token);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

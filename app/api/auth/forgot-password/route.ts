import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  dispatchPasswordResetEmail,
  resolveAuthUserForContactEmail,
} from "@/app/lib/email/dispatch-password-reset";
import { recipientDomainForLog } from "@/app/lib/email/auth-email-config";

const GENERIC_SUCCESS = {
  ok: true as const,
  message:
    "If an account exists for that email, you will receive password reset instructions shortly.",
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[auth-email] Missing Supabase server configuration");
    return null;
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Public forgot-password endpoint.
 * Resolves contact email → linked Auth user via accepted invitations, then
 * generates recovery for Auth identity and emails the contact address.
 * Always returns a generic success payload to prevent account enumeration.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = normalizeEmail(body.email);

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(GENERIC_SUCCESS);
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json(GENERIC_SUCCESS);
    }

    const resolved = await resolveAuthUserForContactEmail(supabase, email);
    if (!resolved) {
      console.info("[auth-email] Forgot-password: no linked Auth user for contact", {
        deliveryDomain: recipientDomainForLog(email),
      });
      return NextResponse.json(GENERIC_SUCCESS);
    }

    const result = await dispatchPasswordResetEmail(supabase, {
      authUserId: resolved.authUserId,
      deliveryEmail: resolved.deliveryEmail,
      invitationId: resolved.invitationId,
    });

    if (result.error) {
      console.error("[auth-email] Forgot-password dispatch failed", {
        invitationId: resolved.invitationId,
        deliveryDomain: recipientDomainForLog(email),
        message: result.error.message,
      });
    }

    return NextResponse.json(GENERIC_SUCCESS);
  } catch (error) {
    console.error(
      "[auth-email] Forgot-password unexpected error",
      error instanceof Error ? error.message : "unknown"
    );
    return NextResponse.json(GENERIC_SUCCESS);
  }
}

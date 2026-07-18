import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispatchPasswordResetEmail } from "@/app/lib/email/dispatch-password-reset";
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
 * Always returns a generic success payload to prevent account enumeration.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = normalizeEmail(body.email);

    if (!email || !isValidEmail(email)) {
      // Still generic — do not reveal validation beyond a soft client check.
      return NextResponse.json(GENERIC_SUCCESS);
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json(GENERIC_SUCCESS);
    }

    const result = await dispatchPasswordResetEmail(supabase, email);

    if (result.error) {
      console.error("[auth-email] Forgot-password dispatch failed", {
        domain: recipientDomainForLog(email),
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

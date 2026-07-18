import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispatchPasswordResetEmail } from "@/app/lib/email/dispatch-password-reset";
import {
  resolveAuthEmailConfig,
  recipientDomainForLog,
} from "@/app/lib/email/auth-email-config";

/**
 * Development-only password-reset email test.
 * POST { "email": "you@example.com" }
 * Returns Resend message id or exact delivery error — never the recovery link.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, error: "Provide a test email address" },
      { status: 400 }
    );
  }

  const config = resolveAuthEmailConfig();
  if (!config.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Missing configuration: ${config.missing.join(", ")}`,
        missing: config.missing,
      },
      { status: 500 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase server configuration" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await dispatchPasswordResetEmail(supabase, email, {
    recipientName: "Test Recipient",
  });

  return NextResponse.json({
    ok: result.emailDispatched,
    linkGenerated: result.linkGenerated,
    emailDispatched: result.emailDispatched,
    messageId: result.messageId,
    domain: recipientDomainForLog(email),
    error: result.error?.message ?? null,
    suppressed: !result.emailDispatched && !result.error && result.linkGenerated,
    note: "Recovery link is never returned by this endpoint.",
  });
}

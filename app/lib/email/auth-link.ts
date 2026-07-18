/**
 * First-party Auth link helpers for branded emails.
 * Official Supabase flow: admin.generateLink → hashed_token in app URL → verifyOtp.
 * Never log token hashes or full generated URLs.
 */

import { resolveAppUrl } from "@/app/lib/email/auth-email-config";

export type AuthEmailLinkType = "invite" | "recovery" | "magiclink";

export function extractHashedToken(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const properties = root.properties;
  if (properties && typeof properties === "object") {
    const hashed = (properties as Record<string, unknown>).hashed_token;
    if (typeof hashed === "string" && hashed.trim()) {
      return hashed.trim();
    }
  }
  const direct = root.hashed_token;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  return null;
}

export function extractVerificationType(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const properties = root.properties;
  if (properties && typeof properties === "object") {
    const value = (properties as Record<string, unknown>).verification_type;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

/** Builds a first-party One Eyrie URL; never embeds a *.supabase.co host. */
export function buildFirstPartyAuthUrl(input: {
  path: "/auth/callback" | "/auth/reset-password";
  tokenHash: string;
  type: AuthEmailLinkType;
}): string {
  const origin = resolveAppUrl();
  const url = new URL(`${origin}${input.path}`);
  url.searchParams.set("token_hash", input.tokenHash);
  url.searchParams.set("type", input.type);
  return url.toString();
}

export function buildInvitationAcceptUrl(tokenHash: string, type: AuthEmailLinkType = "invite"): string {
  return buildFirstPartyAuthUrl({
    path: "/auth/callback",
    tokenHash,
    type,
  });
}

export function buildPasswordResetAcceptUrl(tokenHash: string): string {
  return buildFirstPartyAuthUrl({
    path: "/auth/reset-password",
    tokenHash,
    type: "recovery",
  });
}

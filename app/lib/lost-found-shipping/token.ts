import { createHash, randomBytes } from "crypto";

const TOKEN_BYTES = 32;

/** How long the original guest link stays valid for tracking after payment/label. */
export const GUEST_TRACKING_LINK_TTL_HOURS = 90 * 24; // 90 days

/** Opaque guest token (shown once in URL). Never store the raw value. */
export function generateShippingGuestToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashShippingGuestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function tokenExpiresAt(ttlHours: number, from = new Date()): Date {
  const hours = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 168;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

/** Extend guest link life so the same URL remains a tracking page after payment. */
export function trackingLinkExpiresAt(from = new Date()): Date {
  return tokenExpiresAt(GUEST_TRACKING_LINK_TTL_HOURS, from);
}

export function isTokenExpired(expiresAt: string | Date, now = new Date()): boolean {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

/**
 * Later of current expiry vs tracking window — never shorten an already-long link.
 */
export function laterTokenExpiry(
  currentExpiresAt: string | Date | null | undefined,
  from = new Date()
): string {
  const tracking = trackingLinkExpiresAt(from).getTime();
  const current =
    currentExpiresAt != null ? new Date(currentExpiresAt).getTime() : 0;
  const pick = Number.isFinite(current) && current > tracking ? current : tracking;
  return new Date(pick).toISOString();
}

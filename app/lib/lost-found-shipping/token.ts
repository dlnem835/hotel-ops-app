import { createHash, randomBytes } from "crypto";

const TOKEN_BYTES = 32;

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

export function isTokenExpired(expiresAt: string | Date, now = new Date()): boolean {
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}

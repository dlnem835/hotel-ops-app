import "server-only";

/**
 * Redact Stripe secret material from error strings so guests can see the
 * real failure reason without leaking key values.
 */
export function redactCheckoutSecrets(message: string): string {
  return String(message || "")
    .replace(/sk_(test|live)_[A-Za-z0-9]+/gi, "sk_$1_***")
    .replace(/whsec_[A-Za-z0-9]+/gi, "whsec_***")
    .replace(/pk_(test|live)_[A-Za-z0-9]+/gi, "pk_$1_***")
    .trim();
}

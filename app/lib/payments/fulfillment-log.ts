import "server-only";

import { redactStripeId } from "@/app/lib/payments/types";

type LogLevel = "info" | "warn" | "error";

/**
 * Structured production logs for Stripe → Shippo fulfillment.
 * Never logs secrets, raw webhook bodies, or full addresses.
 */
export function logFulfillment(
  level: LogLevel,
  step: string,
  fields: Record<string, unknown> = {}
): void {
  const payload = {
    scope: "shipping-fulfillment",
    step,
    at: new Date().toISOString(),
    vercelEnv: process.env.VERCEL_ENV || null,
    ...sanitize(fields),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

function sanitize(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) {
      out[key] = value;
      continue;
    }
    if (
      /secret|whsec_|sk_live|sk_test|authorization|password|token/i.test(key)
    ) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string") {
      if (/^(cs_|pi_|evt_|ch_|txn_|shippo_)/i.test(value)) {
        out[key] = redactStripeId(value);
        continue;
      }
      if (/sk_live|sk_test|whsec_/i.test(value)) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = value.length > 400 ? `${value.slice(0, 400)}…` : value;
      continue;
    }
    out[key] = value;
  }
  return out;
}

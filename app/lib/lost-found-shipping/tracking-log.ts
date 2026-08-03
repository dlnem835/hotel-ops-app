import "server-only";

/**
 * Structured logs for Shippo tracking webhook + reconciliation.
 * Never log secrets or full webhook bodies.
 */
export function logTrackingSync(
  level: "info" | "warn" | "error",
  step: string,
  fields: Record<string, unknown> = {}
): void {
  const line = JSON.stringify({
    scope: "shippo-tracking",
    step,
    at: new Date().toISOString(),
    vercelEnv: process.env.VERCEL_ENV || null,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

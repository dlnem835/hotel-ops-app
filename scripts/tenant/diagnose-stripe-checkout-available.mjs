/**
 * Diagnose why checkoutAvailable is false.
 * Does not print secret values — only presence, prefix, and validation outcome.
 */
import fs from "fs";
import path from "path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.log("envFile: MISSING (.env.local not found)");
    return;
  }
  console.log("envFile: found .env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function read(name) {
  return (process.env[name] ?? "").trim();
}

function validateStripeCheckoutEnv() {
  const issues = [];
  const secret = read("STRIPE_SECRET_KEY");
  if (!secret) {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      message:
        "Required for Stripe Checkout (set sk_test_… or sk_live_… in the deployment environment).",
      reason: "missing_secret",
    });
  } else if (secret.startsWith("sk_test_") || secret.startsWith("sk_live_")) {
    // valid
  } else {
    issues.push({
      key: "STRIPE_SECRET_KEY",
      message:
        "Unexpected Stripe secret format. Expected sk_test_… or sk_live_…",
      reason: "invalid_secret_format",
      actualPrefix: secret.slice(0, Math.min(10, secret.length)),
    });
  }
  return issues;
}

loadEnvLocal();

const secret = read("STRIPE_SECRET_KEY");
const webhook = read("STRIPE_WEBHOOK_SECRET");
const publishable = read("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

console.log("\n=== Variables that affect checkoutAvailable ===");
console.log(
  "Required by isStripeCheckoutEnvReady / validateStripeCheckoutEnv:"
);
console.log(
  "  - STRIPE_SECRET_KEY must be present and start with sk_test_ or sk_live_"
);
console.log(
  "NOT required for checkoutAvailable (but needed later for webhooks/client):"
);
console.log("  - STRIPE_WEBHOOK_SECRET");
console.log("  - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

console.log("\n=== Current values (safe summary) ===");
console.log({
  STRIPE_SECRET_KEY: secret
    ? {
        present: true,
        length: secret.length,
        prefix: secret.slice(0, 8),
        startsWithSkTest: secret.startsWith("sk_test_"),
        startsWithSkLive: secret.startsWith("sk_live_"),
      }
    : { present: false },
  STRIPE_WEBHOOK_SECRET: webhook
    ? {
        present: true,
        length: webhook.length,
        prefix: webhook.slice(0, 6),
        note: "Not used by checkoutAvailable",
      }
    : { present: false, note: "Not used by checkoutAvailable" },
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: publishable
    ? {
        present: true,
        length: publishable.length,
        prefix: publishable.slice(0, 8),
        note: "Not used by checkoutAvailable",
      }
    : { present: false, note: "Not used by checkoutAvailable" },
});

const issues = validateStripeCheckoutEnv();
const checkoutAvailable = issues.length === 0;

console.log("\n=== Result ===");
console.log("checkoutAvailable:", checkoutAvailable);
console.log(
  "failureMode:",
  checkoutAvailable
    ? "none — configuration passes"
    : "configuration — Checkout Session was NOT attempted; GET only checks env"
);
console.log("failingIssues:", issues);

if (!checkoutAvailable) {
  console.log("\nExact condition causing false:");
  for (const issue of issues) {
    console.log(`- ${issue.key}: ${issue.reason} → ${issue.message}`);
  }
}

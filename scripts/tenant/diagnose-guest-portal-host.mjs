/**
 * Identify which host serves guest shipping and what checkoutAvailable returns.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const found = {};
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
    found[key] = value;
  }
  return found;
}

function classifyHost(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return "localhost";
    if (host.includes("vercel.app")) {
      if (host.startsWith("hotel-ops-app") && !host.includes("-git-")) {
        // could still be production custom domain elsewhere
      }
      if (host.includes("-git-") || host.includes("preview")) return "vercel_preview";
      return "vercel_host";
    }
    return "production_or_custom";
  } catch {
    return "unknown";
  }
}

async function probe(baseUrl, token) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/shipping-request/${encodeURIComponent(token)}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual" });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      checkoutAvailable: json?.checkoutAvailable,
      checkoutMode: json?.checkoutMode ?? null,
      checkoutUnavailableReason: json?.checkoutUnavailableReason ?? null,
      hasRequest: Boolean(json?.request),
      requestState: json?.request?.state ?? null,
      propertyName: json?.request?.propertyName ?? null,
      error: json?.error ?? null,
      bodyKeys: json ? Object.keys(json) : [],
      rawSnippet: json ? null : text.slice(0, 200),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      networkError: error instanceof Error ? error.message : String(error),
    };
  }
}

loadEnvLocal();
const { createClient } = require("@supabase/supabase-js");

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
const secret = (process.env.STRIPE_SECRET_KEY || "").trim();

console.log("=== Configured public URLs ===");
console.log({
  NEXT_PUBLIC_APP_URL: appUrl || null,
  NEXT_PUBLIC_SITE_URL: siteUrl || null,
  appUrlClass: appUrl ? classifyHost(appUrl) : null,
});

console.log("\n=== Local .env.local Stripe secret (process reading this script) ===");
console.log({
  STRIPE_SECRET_KEY_present: Boolean(secret),
  prefix: secret ? secret.slice(0, 8) : null,
  startsWithSkTest: secret.startsWith("sk_test_"),
  localCheckoutAvailableWouldBe:
    Boolean(secret) &&
    (secret.startsWith("sk_test_") || secret.startsWith("sk_live_")),
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase env; cannot load a real guest token.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Find a recent shipping request and a guest-link event if any; we need a live token.
// Tokens are only returned at create/issue time — not stored plaintext.
// Probe with a fake token only proves endpoint reachability + checkoutAvailable
// when resolve returns unavailable (still returns checkoutAvailable).

const candidates = [];
if (appUrl) candidates.push({ label: "NEXT_PUBLIC_APP_URL", base: appUrl });
if (siteUrl && siteUrl !== appUrl) {
  candidates.push({ label: "NEXT_PUBLIC_SITE_URL", base: siteUrl });
}
candidates.push({ label: "localhost:3000", base: "http://localhost:3000" });
candidates.push({ label: "localhost:3001", base: "http://localhost:3001" });

// Also try common vercel production hostname if present in package/git remote later
const fakeToken = "diagnose-checkout-available-token-000000000000";

console.log("\n=== Probing hosts with GET /api/shipping-request/[token] ===");
const results = [];
for (const c of candidates) {
  const probeResult = await probe(c.base, fakeToken);
  const row = {
    label: c.label,
    base: c.base,
    hostClass: classifyHost(c.base),
    ...probeResult,
  };
  results.push(row);
  console.log(JSON.stringify(row));
}

const reachable = results.filter((r) => r.status > 0 && !r.networkError);
const withFlag = reachable.filter((r) => typeof r.checkoutAvailable === "boolean");

console.log("\n=== Verdict helpers ===");
console.log({
  reachableHosts: reachable.map((r) => r.base),
  hostsReturningCheckoutFlag: withFlag.map((r) => ({
    base: r.base,
    checkoutAvailable: r.checkoutAvailable,
    status: r.status,
  })),
});

// Prefer APP_URL if reachable; else first reachable
const primary =
  withFlag.find((r) => r.base === appUrl) ||
  withFlag.find((r) => r.hostClass === "localhost") ||
  withFlag[0] ||
  null;

if (!primary) {
  console.log("\nACTUAL_CAUSE: No reachable Next server returned checkoutAvailable.");
  console.log(
    "The guest portal host is not responding on configured URLs / localhost."
  );
  process.exit(2);
}

console.log("\n=== Primary server under test ===");
console.log({
  base: primary.base,
  hostClass: primary.hostClass,
  label: primary.label,
  checkoutAvailable: primary.checkoutAvailable,
  httpStatus: primary.status,
});

if (primary.checkoutAvailable === true) {
  console.log("\nACTUAL_CAUSE: None on this host — checkoutAvailable is true.");
  console.log(
    "If the browser still shows unavailable, it is not hitting this host or is stale."
  );
} else if (primary.checkoutAvailable === false) {
  console.log("\nACTUAL_CAUSE: Configuration on this server process.");
  console.log(
    "GET returned checkoutAvailable:false because getStripeCheckoutStatus() failed."
  );
  console.log(
    "That means STRIPE_SECRET_KEY is missing, empty, or not sk_test_/sk_live_ in THIS server process."
  );
  if (primary.checkoutUnavailableReason) {
    console.log("checkoutUnavailableReason:", primary.checkoutUnavailableReason);
  }
  if (primary.checkoutMode != null) {
    console.log("checkoutMode:", primary.checkoutMode);
  }
  if (primary.hostClass === "localhost") {
    console.log(
      "REQUIRED_STEP: Restart the local Next.js server so it reloads .env.local (STRIPE_SECRET_KEY is present in .env.local for this workspace)."
    );
  } else {
    console.log(
      "REQUIRED_STEP: Set STRIPE_SECRET_KEY=sk_test_… or sk_live_… for Production in Vercel → Environment Variables, then redeploy."
    );
  }
} else {
  console.log(
    "\nACTUAL_CAUSE: Endpoint reachable but checkoutAvailable field missing — old deploy without the flag."
  );
}

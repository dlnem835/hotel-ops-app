/**
 * Fetch a previously sent Resend email HTML for diagnosis.
 * Usage: node scripts/tenant/fetch-resend-email.mjs <email-id>
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const id = process.argv[2];
if (!id) {
  console.error("Usage: node scripts/tenant/fetch-resend-email.mjs <email-id>");
  process.exit(1);
}

const key = process.env.RESEND_API_KEY;
if (!key) {
  console.error("Missing RESEND_API_KEY");
  process.exit(1);
}

const res = await fetch(`https://api.resend.com/emails/${id}`, {
  headers: { Authorization: `Bearer ${key}` },
});
const json = await res.json();
const out = path.resolve(process.cwd(), "tmp-resend-fetched.html");
const html = typeof json.html === "string" ? json.html : "";
fs.writeFileSync(
  out,
  html || JSON.stringify(json, null, 2),
  "utf8"
);

const hay = html || JSON.stringify(json);
const hits = {
  ffffff: (hay.match(/#ffffff/gi) || []).length,
  white: (hay.match(/\bwhite\b/gi) || []).length,
  rgb255: (hay.match(/rgb\s*\(\s*255\s*,\s*255\s*,\s*255\s*\)/gi) || []).length,
  transparent: (hay.match(/transparent/gi) || []).length,
  surface211: (hay.match(/#211F1B/gi) || []).length,
  surface1A: (hay.match(/#1A1815/gi) || []).length,
};

console.log(
  JSON.stringify(
    {
      status: res.status,
      out,
      htmlBytes: Buffer.byteLength(html, "utf8"),
      keys: Object.keys(json),
      hits,
    },
    null,
    2
  )
);

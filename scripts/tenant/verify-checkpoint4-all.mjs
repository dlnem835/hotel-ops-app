/**
 * Run all Checkpoint 4 tenant verification scripts in order.
 *
 * Usage: node scripts/tenant/verify-checkpoint4-all.mjs
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCRIPTS = [
  "verify-checkpoint3-context.mjs",
  "verify-checkpoint4-sc2.mjs",
  "verify-checkpoint4-sc3.mjs",
  "verify-checkpoint4-sc5.mjs",
  "verify-checkpoint4-sc6.mjs",
  "verify-checkpoint4-sc7.mjs",
  "verify-checkpoint4-sc8.mjs",
  "verify-checkpoint5-rls.mjs",
];

let failures = 0;

for (const script of SCRIPTS) {
  const scriptPath = path.join(__dirname, script);
  console.log(`\n========== ${script} ==========\n`);
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    failures += 1;
  }
}

console.log(`\n========== Summary ==========\n`);
if (failures > 0) {
  console.log(`FAILED  ${failures} verification script(s)`);
  process.exit(1);
}

console.log("OK      All tenant verification scripts passed");

/**
 * Verify the in-code RPM Guest Room master includes Carpet/Flooring
 * without changing HK Vacant Ready or existing RPM items/weights.
 *
 * Usage: node scripts/tenant/verify-rpm-guest-room-standard-v21.mjs
 */

import assert from "assert";
import fs from "fs";
import path from "path";

const snapshot = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "app/inspections/lib/standard-inspection-library.snapshot.json"),
    "utf8"
  )
);

const guidance = fs.readFileSync(
  path.join(process.cwd(), "app/inspections/lib/rpm-guest-room-ui.ts"),
  "utf8"
);

const EXISTING_RPM_BEDROOM = [
  ["hvac", 5],
  ["windows", 3],
  ["furniture", 3],
  ["electrical", 5],
  ["tv-phone", 3],
  ["ceiling-walls", 3],
];

function points(template) {
  return template.categories.reduce(
    (sum, category) =>
      sum +
      category.items.reduce((itemSum, item) => itemSum + (Number(item.pointValue) || 0), 0),
    0
  );
}

function items(template) {
  return template.categories.reduce((sum, category) => sum + category.items.length, 0);
}

const hk = snapshot.templates.find((entry) => entry.key === "hk-vacant-ready");
const rpm = snapshot.templates.find((entry) => entry.key === "rpm-guest-room");
assert.ok(hk, "hk-vacant-ready exists");
assert.ok(rpm, "rpm-guest-room exists");

assert.strictEqual(hk.version, "2.0", "HK master version is unchanged");
assert.strictEqual(rpm.version, "2.1", "RPM master version is 2.1");

const bedroom = rpm.categories.find((category) => category.key === "bedroom");
assert.ok(bedroom, "RPM Bedroom category exists");

for (const [key, weight] of EXISTING_RPM_BEDROOM) {
  const item = bedroom.items.find((entry) => entry.key === key);
  assert.ok(item, `existing RPM Bedroom item ${key} is preserved`);
  assert.strictEqual(item.pointValue, weight, `${key} weight is unchanged`);
  assert.strictEqual(item.required, true, `${key} remains required`);
}

const floor = bedroom.items.find((entry) => entry.key === "carpet-flooring");
assert.ok(floor, "new carpet-flooring item exists");
assert.strictEqual(floor.pointValue, 3);
assert.strictEqual(floor.required, true);
assert.match(
  floor.label.en,
  /Carpet\/Flooring: Have carpets and floors been deep cleaned/
);
assert.ok(floor.label.es, "Spanish label is present");

assert.strictEqual(
  bedroom.items.at(-1).key,
  "carpet-flooring",
  "new item is appended after existing Bedroom items"
);

assert.strictEqual(items(rpm), 20, "RPM item count is 20");
assert.strictEqual(points(rpm), 71, "RPM total possible points is 71 (was 68 + 3)");
assert.ok(
  !hk.categories.some((category) =>
    category.items.some((item) => item.key === "carpet-flooring")
  ),
  "HK Vacant Ready was not given the RPM flooring item"
);

const content = {
  categories: rpm.categories.map((category, categoryIndex) => ({
    key: category.key,
    sortOrder: categoryIndex,
    items: category.items.map((item, itemIndex) => ({
      key: item.key,
      pointValue: item.pointValue,
      required: item.required,
      sortOrder: itemIndex,
    })),
  })),
};
const activateCopy = content.categories
  .find((category) => category.key === "bedroom")
  .items.find((item) => item.key === "carpet-flooring");
assert.ok(activateCopy, "activate/restore property content includes carpet-flooring");
assert.strictEqual(activateCopy.pointValue, 3);
assert.strictEqual(activateCopy.required, true);

assert.match(guidance, /bedroom::carpet-flooring/, "RPM inspect guidance includes the new item");

console.log("pass  RPM Guest Room master v2.1");
console.log("      Bedroom carpet-flooring weight 3, required");
console.log("      existing Bedroom items/weights preserved");
console.log("      total possible points 71 (20 items)");
console.log("      HK Vacant Ready still v2.0");
console.log("      activate/restore content mapping includes the new item");

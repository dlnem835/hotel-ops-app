/**
 * Emit final guest shipping email HTML as JSON on stdout.
 * Run via: node scripts/tenant/preview-guest-shipping-email.mjs
 */
import { buildAutomatedShippingEmail } from "../../app/lib/lost-found-shipping/automated-shipping-email";

const content = buildAutomatedShippingEmail({
  guestName: "NEMETH",
  itemName: "Black North Face Backpack",
  propertyName: "Springhill Suites Tampa Suncoast Parkway",
  propertyPhone: "8135361900",
  propertyAddressLine: "16615 Crosspointe Run, Land O Lakes, FL, 34638",
  guestShippingUrl:
    "https://app.oneeyrie.com/shipping-request/sample-token-preview-only",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
});

process.stdout.write(JSON.stringify(content));

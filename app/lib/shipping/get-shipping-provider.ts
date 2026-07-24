import type { ShippingProvider } from "./provider";
import { MockShippingProvider } from "./providers/mock-provider";

/**
 * Factory for the active shipping provider.
 * Phase 1: always mock. Phase 2: SHIPPING_PROVIDER=shippo.
 */
export function getShippingProvider(): ShippingProvider {
  const configured = (process.env.SHIPPING_PROVIDER || "mock").trim().toLowerCase();

  if (configured === "shippo") {
    // Phase 2: return new ShippoShippingProvider()
    throw new Error(
      "Shippo provider is not enabled yet. Set SHIPPING_PROVIDER=mock for Phase 1."
    );
  }

  return new MockShippingProvider();
}

import type { ShippingProvider } from "./provider";
import {
  assertShippingProviderEnvReady,
  getShippingProviderMode,
} from "./env";
import { MockShippingProvider } from "./providers/mock-provider";
import { ShippoShippingProvider } from "./providers/shippo-provider";

/**
 * Factory for the active shipping provider.
 * Phase 1 default: mock. Phase 2: SHIPPING_PROVIDER=shippo + SHIPPO_API_TOKEN.
 */
export function getShippingProvider(): ShippingProvider {
  const mode = getShippingProviderMode();

  if (mode === "shippo") {
    assertShippingProviderEnvReady("shippo");
    return new ShippoShippingProvider();
  }

  return new MockShippingProvider();
}

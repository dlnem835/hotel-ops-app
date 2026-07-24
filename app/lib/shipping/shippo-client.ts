import "server-only";

import { Shippo } from "shippo";
import { getShippoApiToken } from "@/app/lib/shipping/env";

let cached: Shippo | null = null;

/** Server-only Shippo SDK client (test token enforced by env validation). */
export function getShippoClient(): Shippo {
  if (cached) return cached;
  cached = new Shippo({
    apiKeyHeader: getShippoApiToken(),
  });
  return cached;
}

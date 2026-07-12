import type { TenantContextResponse } from "@/app/lib/tenant/types";

export async function fetchTenantContext(
  accessToken: string,
  requestedPropertyId?: number | null
): Promise<TenantContextResponse> {
  const query =
    requestedPropertyId != null
      ? `?propertyId=${encodeURIComponent(String(requestedPropertyId))}`
      : "";

  const response = await fetch(`/api/tenant/context${query}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as TenantContextResponse & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Unable to load tenant context");
  }

  return payload;
}

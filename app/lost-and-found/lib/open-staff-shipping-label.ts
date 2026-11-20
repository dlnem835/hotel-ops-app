import { tenantFetch, readTenantJson } from "@/app/lib/tenant/tenant-fetch";

export async function fetchStaffShippingLabelUrl(input: {
  itemId: number | string;
  shippingRequestId?: number | null;
}): Promise<string> {
  const itemId = encodeURIComponent(String(input.itemId));
  const path =
    input.shippingRequestId != null
      ? `/api/lost-and-found/${itemId}/shipping-requests/${input.shippingRequestId}/label`
      : `/api/lost-and-found/${itemId}/historical-label`;
  const response = await tenantFetch(path);
  const result = await readTenantJson<{ error?: string; url?: string }>(
    response
  );
  if (!response.ok || !result.url) {
    throw new Error(result.error || "Unable to open shipping label");
  }
  return String(result.url);
}

export function openStaffShippingLabelTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

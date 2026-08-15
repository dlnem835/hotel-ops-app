import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

export async function uploadWorkOrderPhoto(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await tenantFetch("/api/work-orders/photo", {
    method: "POST",
    body: formData,
  });
  const result = await response.json();
  if (!response.ok || !result.photoUrl) {
    throw new Error(result.error || "Unable to upload work order photo.");
  }
  return String(result.photoUrl);
}

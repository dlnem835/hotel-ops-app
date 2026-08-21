import { supabase } from "@/app/supabaseClient";
import { tenantFetch } from "@/app/lib/tenant/tenant-fetch";

type SignPhotoResponse = {
  error?: string;
  signedUrl?: string;
  token?: string;
  path?: string;
  photoUrl?: string;
  storagePath?: string;
};

async function readJsonSafely(response: Response): Promise<SignPhotoResponse | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as SignPhotoResponse;
  } catch {
    const trimmed = text.trim();
    if (/request entity too large/i.test(trimmed) || response.status === 413) {
      throw new Error(
        "Photo is too large for upload. Use an image under 12 MB, or take a smaller photo."
      );
    }
    throw new Error(
      trimmed.slice(0, 160) || `Photo upload failed (${response.status})`
    );
  }
}

/**
 * Uploads a work-order photo via signed URL (direct to Supabase Storage).
 * Never routes the binary through the Next.js/Vercel function body.
 */
export async function uploadWorkOrderPhoto(file: File): Promise<string> {
  const signResponse = await tenantFetch("/api/work-orders/photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name || "photo.jpg",
      contentType: file.type || "image/jpeg",
      fileSize: file.size,
    }),
  });

  const signed = await readJsonSafely(signResponse);
  if (!signResponse.ok || !signed?.token || !signed?.path || !signed?.photoUrl) {
    throw new Error(signed?.error || "Unable to prepare work order photo upload.");
  }

  const { error: uploadError } = await supabase.storage
    .from("work-order-photos")
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Unable to upload work order photo.");
  }

  return String(signed.photoUrl);
}

import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

/** Soft product limit for photos; signed upload bypasses Vercel body size. */
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function extensionFor(contentType: string, fileName: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/heic" || contentType === "image/heif") return "heic";
  return "jpg";
}

/**
 * Issues a Supabase signed upload URL so the browser uploads the file
 * directly to Storage. This avoids Vercel's 4.5 MB function body limit,
 * which previously returned plain-text "Request Entity Too Large" and
 * broke client `response.json()` parsing.
 */
export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );

    const body = (await request.json().catch(() => null)) as {
      fileName?: string;
      contentType?: string;
      fileSize?: number;
    } | null;

    const fileName = String(body?.fileName || "").trim() || "photo.jpg";
    const contentType = String(body?.contentType || "").trim().toLowerCase();
    const fileSize = Number(body?.fileSize);

    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, or HEIC images are allowed" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json(
        { error: "Valid fileSize is required" },
        { status: 400 }
      );
    }

    if (fileSize > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Image must be 12 MB or smaller" },
        { status: 400 }
      );
    }

    const extension = extensionFor(contentType, fileName);
    const filePath = `org-${organizationId}/property-${propertyId}/manual/${Date.now()}.${extension}`;

    const { data, error: signedError } = await supabase.storage
      .from("work-order-photos")
      .createSignedUploadUrl(filePath);

    if (signedError || !data?.signedUrl || !data?.token || !data?.path) {
      return NextResponse.json(
        {
          error:
            signedError?.message ||
            "Unable to create a signed upload URL for this photo",
        },
        { status: 500 }
      );
    }

    const { data: publicData } = supabase.storage
      .from("work-order-photos")
      .getPublicUrl(data.path);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
      photoUrl: publicData.publicUrl,
      storagePath: data.path,
      maxBytes: MAX_FILE_BYTES,
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

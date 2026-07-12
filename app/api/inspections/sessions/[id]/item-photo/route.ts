import { NextResponse } from "next/server";
import { fetchInspectionSession } from "@/app/inspections/lib/inspection-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const sessionId = Number(id);
    if (!sessionId) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const categoryKey = String(formData.get("categoryKey") || "");
    const itemKey = String(formData.get("itemKey") || "");

    if (!file || !categoryKey || !itemKey) {
      return NextResponse.json(
        { error: "File, categoryKey, and itemKey are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, or HEIC images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Image must be 8 MB or smaller" },
        { status: 400 }
      );
    }

    const scope = { organizationId, propertyId };
    const session = await fetchInspectionSession(supabase, sessionId, scope);

    if (session.status !== "in_progress") {
      return NextResponse.json(
        { error: "Photos can only be added to in-progress inspections" },
        { status: 400 }
      );
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `org-${organizationId}/property-${propertyId}/inspections/${sessionId}/${sanitizeSegment(categoryKey)}--${sanitizeSegment(itemKey)}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("inspection-photos")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from("inspection-photos").getPublicUrl(filePath);

    return NextResponse.json({
      photoUrl: data.publicUrl,
      storagePath: filePath,
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

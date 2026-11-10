import { NextResponse } from "next/server";
import {
  isOperationalPhotoBucket,
  isOperationalPhotoParent,
  refreshOperationalPhotoDisplayUrl,
} from "@/app/lib/storage/server/operational-photo-access";
import type { OperationalPhotoBucket } from "@/app/lib/storage/operational-photo-types";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const body = (await request.json().catch(() => null)) as {
      photoUrl?: string;
      parent?: unknown;
      defaultBucket?: string;
    } | null;

    const photoUrl = String(body?.photoUrl || "").trim();
    if (!photoUrl) {
      return NextResponse.json({ error: "photoUrl is required" }, { status: 400 });
    }

    const defaultBucket = isOperationalPhotoBucket(String(body?.defaultBucket || ""))
      ? (body?.defaultBucket as OperationalPhotoBucket)
      : undefined;
    const parent = isOperationalPhotoParent(body?.parent) ? body.parent : null;

    const signedUrl = await refreshOperationalPhotoDisplayUrl(
      supabase,
      photoUrl,
      { organizationId, propertyId },
      parent,
      defaultBucket ? { defaultBucket } : undefined
    );

    if (!signedUrl) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    return NextResponse.json({ photoUrl: signedUrl });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

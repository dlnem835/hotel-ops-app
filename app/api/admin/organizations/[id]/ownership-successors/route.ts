import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  PlatformAdminRequestError,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import { listPrimaryOwnershipSuccessors } from "@/app/lib/platform-admin/server/transfer-primary-ownership";

function parseOrganizationId(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, platformAdmin } = await resolvePlatformAdminRequest(request);
    if (platformAdmin.role !== "platform_owner") {
      throw new PlatformAdminRequestError(
        403,
        "Forbidden — platform owner access required"
      );
    }

    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);
    if (organizationId == null) {
      throw new PlatformAdminRequestError(400, "Invalid organization id");
    }

    const successors = await listPrimaryOwnershipSuccessors(
      supabase,
      organizationId
    );
    return NextResponse.json({ successors });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}

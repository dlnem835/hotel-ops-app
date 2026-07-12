import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { markPassOnViewed } from "@/app/pass-on-log/lib/pass-on-server-db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId, user } =
      await resolveTenantRequest(request);
    const { id } = await context.params;
    await markPassOnViewed(
      supabase,
      { organizationId, propertyId },
      Number(id),
      user.id
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

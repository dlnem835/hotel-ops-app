import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { markUnreadPassOnViewed } from "@/app/pass-on-log/lib/pass-on-server-db";

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId, user } =
      await resolveTenantRequest(request);
    const marked = await markUnreadPassOnViewed(
      supabase,
      { organizationId, propertyId },
      user.id
    );
    return NextResponse.json({ success: true, marked });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

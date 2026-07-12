import { NextResponse } from "next/server";
import { fetchTeamMembersForTenant } from "@/app/settings/lib/team-members-db";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const members = await fetchTeamMembersForTenant(supabase, {
      organizationId,
      propertyId,
    });
    return NextResponse.json({ members });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { assertAdminPortalDeleteAccess } from "@/app/lib/org-admin/server/assert-admin-portal-delete-access";
import {
  deletePassOnEntry,
  getPassOnEntry,
  updatePassOnEntry,
} from "@/app/pass-on-log/lib/pass-on-server-db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const entry = await getPassOnEntry(supabase, Number(id), {
      organizationId,
      propertyId,
    });
    if (!entry) {
      return NextResponse.json({ error: "Pass-on entry not found." }, { status: 404 });
    }
    return NextResponse.json({ entry });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const body = await request.json();
    const message = String(body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "Entry cannot be blank." }, { status: 400 });
    }
    const entry = await updatePassOnEntry(
      supabase,
      Number(id),
      { organizationId, propertyId },
      { message, edited_at: new Date().toISOString() }
    );
    return NextResponse.json({ entry });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { supabase, user, organizationId, propertyId } =
      await resolveTenantRequest(request);
    await assertAdminPortalDeleteAccess(supabase, user.id, organizationId);
    const { id } = await context.params;
    await deletePassOnEntry(supabase, Number(id), { organizationId, propertyId });
    return NextResponse.json({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

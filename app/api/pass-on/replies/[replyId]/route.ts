import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { assertAdminPortalDeleteAccess } from "@/app/lib/org-admin/server/assert-admin-portal-delete-access";
import {
  deletePassOnReply,
  updatePassOnReply,
} from "@/app/pass-on-log/lib/pass-on-server-db";

type RouteContext = { params: Promise<{ replyId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { replyId } = await context.params;
    const body = await request.json();
    const message = String(body.reply_message ?? body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "Reply cannot be blank." }, { status: 400 });
    }
    const reply = await updatePassOnReply(
      supabase,
      Number(replyId),
      { organizationId, propertyId },
      { reply_message: message, edited_at: new Date().toISOString() }
    );
    return NextResponse.json({ reply });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { supabase, user, organizationId, propertyId } =
      await resolveTenantRequest(request);
    await assertAdminPortalDeleteAccess(supabase, user.id, organizationId);
    const { replyId } = await context.params;
    const count = await deletePassOnReply(supabase, Number(replyId), {
      organizationId,
      propertyId,
    });
    if (count === 0) {
      return NextResponse.json(
        { error: "Unable to delete this reply." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

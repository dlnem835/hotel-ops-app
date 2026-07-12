import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import {
  addPassOnReply,
  markPassOnViewed,
} from "@/app/pass-on-log/lib/pass-on-server-db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId, user } =
      await resolveTenantRequest(request);
    const { id } = await context.params;
    const entryId = Number(id);
    const body = await request.json();
    const replyAuthor = String(body.reply_author ?? body.author ?? "").trim();
    const replyMessage = String(body.reply_message ?? body.message ?? "").trim();

    if (!replyMessage) {
      return NextResponse.json({ error: "Reply cannot be blank." }, { status: 400 });
    }

    const scope = { organizationId, propertyId };
    const reply = await addPassOnReply(supabase, scope, entryId, {
      reply_author: replyAuthor,
      reply_message: replyMessage,
    });
    await markPassOnViewed(supabase, scope, entryId, user.id);

    return NextResponse.json({ reply });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

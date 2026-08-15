import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { assertEntryInTenant } from "@/app/pass-on-log/lib/pass-on-server-db";

const BUCKET = "pass-on-attachments";
const SIGNED_URL_TTL_SECONDS = 300;

type RouteContext = {
  params: Promise<{ id: string; attachmentId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const { id, attachmentId } = await context.params;
    const entryId = Number(id);
    await assertEntryInTenant(supabase, entryId, {
      organizationId,
      propertyId,
    });

    const { data: attachment, error } = await supabase
      .from("pass_on_log_attachments")
      .select("id, entry_id, storage_path")
      .eq("id", Number(attachmentId))
      .eq("entry_id", entryId)
      .eq("organization_id", organizationId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    }

    const { data, error: signedUrlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signedUrlError) throw new Error(signedUrlError.message);

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

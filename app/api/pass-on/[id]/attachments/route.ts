import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import { assertEntryInTenant } from "@/app/pass-on-log/lib/pass-on-server-db";

const BUCKET = "pass-on-attachments";
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
  ["application/pdf", "pdf"],
  ["text/plain", "txt"],
  ["text/csv", "csv"],
  ["application/msword", "doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  ["application/vnd.ms-excel", "xls"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsx",
  ],
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user, organizationId, propertyId } =
      await resolveTenantRequest(request);
    const { id } = await context.params;
    const entryId = Number(id);
    await assertEntryInTenant(supabase, entryId, {
      organizationId,
      propertyId,
    });

    const formData = await request.formData();
    const file = formData.get("file");
    const replyIdValue = String(formData.get("replyId") || "").trim();
    const replyId = replyIdValue ? Number(replyIdValue) : null;
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }
    if (replyId !== null) {
      if (!Number.isInteger(replyId) || replyId <= 0) {
        return NextResponse.json({ error: "Invalid reply." }, { status: 400 });
      }
      const { data: reply, error: replyError } = await supabase
        .from("pass_on_log_replies")
        .select("id")
        .eq("id", replyId)
        .eq("entry_id", entryId)
        .eq("organization_id", organizationId)
        .eq("property_id", propertyId)
        .maybeSingle();
      if (replyError) throw new Error(replyError.message);
      if (!reply) {
        return NextResponse.json({ error: "Reply not found." }, { status: 404 });
      }
    }

    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension) {
      return NextResponse.json(
        {
          error:
            "Attach a photo, PDF, text file, Word document, or Excel document.",
        },
        { status: 400 }
      );
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Attachment must be 8 MB or smaller." },
        { status: 400 }
      );
    }

    const storagePath =
      `org-${organizationId}/property-${propertyId}/pass-on/${entryId}/` +
      `${Date.now()}-${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { data: attachment, error: insertError } = await supabase
      .from("pass_on_log_attachments")
      .insert({
        entry_id: entryId,
        reply_id: replyId,
        organization_id: organizationId,
        property_id: propertyId,
        storage_path: storagePath,
        original_filename: file.name.slice(0, 255) || `attachment.${extension}`,
        content_type: file.type,
        byte_size: file.size,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertError) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      throw new Error(insertError.message);
    }

    return NextResponse.json({ attachment });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

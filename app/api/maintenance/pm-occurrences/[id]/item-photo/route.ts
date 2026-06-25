import { NextResponse } from "next/server";
import { fetchPmOccurrenceById } from "@/app/maintenance/lib/pm-occurrence-db";
import { getSupabaseAdmin } from "@/app/maintenance/lib/pm-db";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const occurrenceId = Number(id);
    if (!occurrenceId) {
      return NextResponse.json({ error: "Invalid occurrence id" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const stepKey = String(formData.get("stepKey") || "");

    if (!file || !stepKey) {
      return NextResponse.json(
        { error: "File and stepKey are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, or HEIC images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Image must be 8 MB or smaller" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const occurrence = await fetchPmOccurrenceById(supabase, occurrenceId);

    if (!occurrence) {
      return NextResponse.json({ error: "PM session not found" }, { status: 404 });
    }

    if (occurrence.status !== "open") {
      return NextResponse.json(
        { error: "Photos can only be added to open PM sessions" },
        { status: 400 }
      );
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `pm/${occurrenceId}/${sanitizeSegment(stepKey)}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("inspection-photos")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from("inspection-photos").getPublicUrl(filePath);

    return NextResponse.json({
      photoUrl: data.publicUrl,
      storagePath: filePath,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

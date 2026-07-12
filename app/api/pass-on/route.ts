import { NextResponse } from "next/server";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";
import {
  createPassOnEntry,
  listPassOnEntries,
} from "@/app/pass-on-log/lib/pass-on-server-db";

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const entries = await listPassOnEntries(supabase, { organizationId, propertyId });
    return NextResponse.json({ entries });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const body = await request.json();
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();
    const author = String(body.author ?? "").trim();
    const priority = String(body.priority ?? "Normal").trim();
    const entryDate = String(body.entry_date ?? body.entryDate ?? "").trim();

    if (!subject || !message) {
      return NextResponse.json(
        { error: "Subject and message are required." },
        { status: 400 }
      );
    }
    if (!entryDate) {
      return NextResponse.json({ error: "Entry date is required." }, { status: 400 });
    }

    const createdAt = String(body.created_at ?? new Date().toISOString());

    const entry = await createPassOnEntry(
      supabase,
      { organizationId, propertyId },
      {
        subject,
        author,
        priority,
        message,
        created_at: createdAt,
        entry_date: entryDate,
      }
    );

    return NextResponse.json({ entry });
  } catch (error) {
    return tenantErrorResponse(error);
  }
}

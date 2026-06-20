import { NextResponse } from "next/server";
import {
  deletePropertyTemplate,
  duplicatePropertyTemplate,
  fetchPropertyTemplateById,
  getSupabaseAdmin,
  restorePropertyTemplateFromStandard,
  savePropertyTemplate,
  setPropertyTemplateStatus,
} from "@/app/inspections/lib/property-template-db";
import {
  PropertyTemplateContent,
  TemplateStatus,
  TemplateType,
} from "@/app/inspections/standards/types";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdmin();
    const template = await fetchPropertyTemplateById(supabaseAdmin, Number(id));
    return NextResponse.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabaseAdmin = getSupabaseAdmin();

    if (body.action === "set_status") {
      const status: TemplateStatus =
        body.status === "Inactive" ? "Inactive" : "Active";
      const template = await setPropertyTemplateStatus(
        supabaseAdmin,
        Number(id),
        status
      );
      return NextResponse.json({ template });
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    if (!body.content?.categories?.length) {
      return NextResponse.json(
        { error: "Add at least one category with checklist items." },
        { status: 400 }
      );
    }

    const template = await savePropertyTemplate(supabaseAdmin, Number(id), {
      name: body.name,
      template_type: body.template_type as TemplateType,
      status: body.status as TemplateStatus,
      content: body.content as PropertyTemplateContent,
    });

    return NextResponse.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdmin();
    await deletePropertyTemplate(supabaseAdmin, Number(id));
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdmin();
    const template = await duplicatePropertyTemplate(supabaseAdmin, Number(id));
    return NextResponse.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

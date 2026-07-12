import { NextResponse } from "next/server";
import {
  deletePropertyTemplate,
  duplicatePropertyTemplate,
  fetchPropertyTemplateById,
  restorePropertyTemplateFromStandard,
  savePropertyTemplate,
  setPropertyTemplateStatus,
} from "@/app/inspections/lib/property-template-db";
import {
  PropertyTemplateContent,
  TemplateStatus,
  TemplateType,
} from "@/app/inspections/standards/types";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const template = await fetchPropertyTemplateById(supabase, Number(id), {
      organizationId,
      propertyId,
    });
    return NextResponse.json({ template });
  } catch (error: unknown) {
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
    const scope = { organizationId, propertyId };

    if (body.action === "set_status") {
      const status: TemplateStatus =
        body.status === "Inactive" ? "Inactive" : "Active";
      const template = await setPropertyTemplateStatus(
        supabase,
        Number(id),
        status,
        scope
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

    const template = await savePropertyTemplate(
      supabase,
      Number(id),
      {
        name: body.name,
        template_type: body.template_type as TemplateType,
        status: body.status as TemplateStatus,
        content: body.content as PropertyTemplateContent,
      },
      scope
    );

    return NextResponse.json({ template });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    await deletePropertyTemplate(supabase, Number(id), {
      organizationId,
      propertyId,
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const { id } = await context.params;
    const template = await duplicatePropertyTemplate(supabase, Number(id), {
      organizationId,
      propertyId,
    });
    return NextResponse.json({ template });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

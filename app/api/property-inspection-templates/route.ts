import { NextResponse } from "next/server";
import {
  activateStandardTemplate,
  fetchAllPropertyTemplates,
} from "@/app/inspections/lib/property-template-db";
import { getStandardSummaries } from "@/app/inspections/standards";
import { getStandardVersion } from "@/app/inspections/standards/index";
import {
  resolveTenantRequest,
  tenantErrorResponse,
} from "@/app/lib/tenant/server/resolve-tenant-request";

export async function GET(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const scope = { organizationId, propertyId };
    const templates = await fetchAllPropertyTemplates(supabase, scope);
    const standards = getStandardSummaries();

    const activatedKeys = new Set(
      templates
        .map((entry) => entry.standard_key)
        .filter((key): key is string => Boolean(key))
    );

    return NextResponse.json({
      templates,
      standards,
      activation: standards.map((standard) => ({
        key: standard.key,
        activated: activatedKeys.has(standard.key),
        standardVersion: standard.version,
        propertyTemplate: templates.find((t) => t.standard_key === standard.key) ?? null,
        updateAvailable:
          activatedKeys.has(standard.key) &&
          templates.some(
            (t) =>
              t.standard_key === standard.key &&
              t.based_on_standard_version !== getStandardVersion(standard.key)
          ),
      })),
    });
  } catch (error: unknown) {
    return tenantErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, organizationId, propertyId } = await resolveTenantRequest(
      request
    );
    const scope = { organizationId, propertyId };
    const body = await request.json();

    if (body.action === "activate") {
      if (!body.standardKey) {
        return NextResponse.json(
          { error: "standardKey is required" },
          { status: 400 }
        );
      }

      const template = await activateStandardTemplate(
        supabase,
        String(body.standardKey),
        scope
      );

      return NextResponse.json({ template });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

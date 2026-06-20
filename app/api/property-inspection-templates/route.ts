import { NextResponse } from "next/server";
import {
  activateStandardTemplate,
  fetchAllPropertyTemplates,
  getSupabaseAdmin,
} from "@/app/inspections/lib/property-template-db";
import { getStandardSummaries } from "@/app/inspections/standards";
import { getStandardVersion } from "@/app/inspections/standards/index";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const templates = await fetchAllPropertyTemplates(supabaseAdmin);
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
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabaseAdmin = getSupabaseAdmin();

    if (body.action === "activate") {
      if (!body.standardKey) {
        return NextResponse.json(
          { error: "standardKey is required" },
          { status: 400 }
        );
      }

      const template = await activateStandardTemplate(
        supabaseAdmin,
        String(body.standardKey)
      );

      return NextResponse.json({ template });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

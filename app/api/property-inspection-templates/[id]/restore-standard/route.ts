import { NextResponse } from "next/server";
import {
  fetchPropertyTemplateById,
  getSupabaseAdmin,
  restorePropertyTemplateFromStandard,
} from "@/app/inspections/lib/property-template-db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabaseAdmin = getSupabaseAdmin();
    const template = await restorePropertyTemplateFromStandard(
      supabaseAdmin,
      Number(id)
    );
    return NextResponse.json({ template });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

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

import { NextResponse } from "next/server";
import {
  deletePmTemplate,
  fetchPmTemplateById,
  getSupabaseAdmin,
  updatePmTemplate,
} from "@/app/maintenance/lib/pm-db";
import { PmTemplateInput } from "@/app/maintenance/lib/pm-types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const result = await fetchPmTemplateById(supabase, Number(id));
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as PmTemplateInput;

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const result = await updatePmTemplate(supabase, Number(id), body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    await deletePmTemplate(supabase, Number(id));
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

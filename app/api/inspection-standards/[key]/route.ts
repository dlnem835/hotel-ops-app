import { NextResponse } from "next/server";
import { getStandardTemplate } from "@/app/inspections/standards";
import { standardToPropertyContent } from "@/app/inspections/standards/builders";

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { key } = await context.params;
  const standard = getStandardTemplate(key);

  if (!standard) {
    return NextResponse.json({ error: "Standard not found" }, { status: 404 });
  }

  return NextResponse.json({
    standard,
    content: standardToPropertyContent(standard),
  });
}

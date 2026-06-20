import { NextResponse } from "next/server";
import { getStandardSummaries } from "@/app/inspections/standards";

export async function GET() {
  return NextResponse.json({
    standards: getStandardSummaries(),
  });
}

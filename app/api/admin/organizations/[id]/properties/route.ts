import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import { createAdminProperty } from "@/app/lib/platform-admin/server/create-property";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseOrganizationId(rawId: string): number | null {
  const organizationId = Number.parseInt(rawId, 10);
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return null;
  }
  return organizationId;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await resolvePlatformAdminRequest(request);
    const { id } = await context.params;
    const organizationId = parseOrganizationId(id);

    if (!organizationId) {
      return NextResponse.json({ error: "Invalid organization id" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const property = await createAdminProperty(supabase, user.id, organizationId, body);
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}

import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import { fetchAdminOrganizations } from "@/app/lib/platform-admin/server/admin-organizations";
import { createAdminOrganization } from "@/app/lib/platform-admin/server/create-organization";

export async function GET(request: Request) {
  try {
    const { supabase } = await resolvePlatformAdminRequest(request);
    const organizations = await fetchAdminOrganizations(supabase);
    return NextResponse.json({ organizations });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await resolvePlatformAdminRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const organization = await createAdminOrganization(supabase, user.id, body);
    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}

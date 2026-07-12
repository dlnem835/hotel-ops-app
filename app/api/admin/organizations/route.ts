import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import { fetchAdminOrganizations } from "@/app/lib/platform-admin/server/admin-organizations";

export async function GET(request: Request) {
  try {
    const { supabase } = await resolvePlatformAdminRequest(request);
    const organizations = await fetchAdminOrganizations(supabase);
    return NextResponse.json({ organizations });
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}

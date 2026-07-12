import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import { fetchAdminDashboard } from "@/app/lib/platform-admin/server/admin-organizations";

export async function GET(request: Request) {
  try {
    const { supabase } = await resolvePlatformAdminRequest(request);
    const dashboard = await fetchAdminDashboard(supabase);
    return NextResponse.json(dashboard);
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}

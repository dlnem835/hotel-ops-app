import { NextResponse } from "next/server";
import {
  platformAdminErrorResponse,
  resolvePlatformAdminRequest,
} from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import type { PlatformAdminMeResponse } from "@/app/lib/platform-admin/types";

export async function GET(request: Request) {
  try {
    const { user, platformAdmin } = await resolvePlatformAdminRequest(request);

    const body: PlatformAdminMeResponse = {
      userId: user.id,
      email: user.email ?? null,
      role: platformAdmin.role,
      platformAdminId: platformAdmin.id,
    };

    return NextResponse.json(body);
  } catch (error) {
    return platformAdminErrorResponse(error);
  }
}

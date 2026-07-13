import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/tenant/server/authenticate-request";
import { isLightModeAllowedForUser } from "@/app/lib/theme/server/light-mode-access";

/**
 * Server-revalidated Light Mode permission for the current session. Returns a
 * boolean only; the authorized UUID never leaves the server. Unauthenticated
 * callers are treated as not allowed (Dark Mode).
 */
export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  const allowed = user ? isLightModeAllowedForUser(user.id) : false;
  return NextResponse.json({ allowed });
}

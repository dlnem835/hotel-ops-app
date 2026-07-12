import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/app/lib/tenant/server/authenticate-request";
import { resolveTenantContextForUser } from "@/app/lib/tenant/server/resolve-tenant-context";

function parseRequestedPropertyId(request: Request): number | null {
  const value = new URL(request.url).searchParams.get("propertyId");
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestedPropertyId = parseRequestedPropertyId(request);
    const context = await resolveTenantContextForUser(user, requestedPropertyId);

    if (!context) {
      return NextResponse.json(
        { error: "No tenant membership found for this user" },
        { status: 403 }
      );
    }

    return NextResponse.json(context);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/app/lib/tenant/server/authenticate-request";
import type {
  PlatformAdminApiContext,
  PlatformAdminRecord,
  PlatformAdminRole,
} from "@/app/lib/platform-admin/types";

/**
 * Error carrying an HTTP status so admin route handlers can fail closed without
 * leaking service-role details.
 */
export class PlatformAdminRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "PlatformAdminRequestError";
    this.status = status;
  }
}

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function mapPlatformAdminRow(row: {
  id: string;
  user_id: string;
  role: string;
  active: boolean;
}): PlatformAdminRecord {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role as PlatformAdminRole,
    active: row.active,
  };
}

export async function resolveActivePlatformAdminForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PlatformAdminRecord | null> {
  const { data, error } = await supabase
    .from("platform_admins")
    .select("id, user_id, role, active")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapPlatformAdminRow(data);
}

/**
 * Authenticates the request and requires an active platform_admins row.
 * Hotel organization/property roles do not grant access.
 */
export async function resolvePlatformAdminRequest(
  request: Request
): Promise<PlatformAdminApiContext> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new PlatformAdminRequestError(401, "Unauthorized");
  }

  const supabase = getServiceClient();
  const platformAdmin = await resolveActivePlatformAdminForUser(supabase, user.id);

  if (!platformAdmin) {
    throw new PlatformAdminRequestError(
      403,
      "Forbidden — platform administrator access required"
    );
  }

  return {
    user,
    supabase,
    platformAdmin,
  };
}

/** Translates a thrown value from `resolvePlatformAdminRequest` into a JSON response. */
export function platformAdminErrorResponse(error: unknown): NextResponse {
  if (error instanceof PlatformAdminRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Server error";
  return NextResponse.json({ error: message }, { status: 500 });
}

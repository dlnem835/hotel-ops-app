import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PLATFORM_ADMIN_ROLES = ["platform_owner", "platform_admin"] as const;

export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export type PlatformAdminRecord = {
  id: string;
  userId: string;
  role: PlatformAdminRole;
  active: boolean;
};

export type PlatformAdminApiContext = {
  user: User;
  /** Service-role client. Only used AFTER platform-admin authorization. */
  supabase: SupabaseClient;
  platformAdmin: PlatformAdminRecord;
};

export type PlatformAdminMeResponse = {
  userId: string;
  email: string | null;
  role: PlatformAdminRole;
  platformAdminId: string;
};

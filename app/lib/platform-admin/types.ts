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

export type AdminOrganizationSummary = {
  id: number;
  name: string;
  slug: string;
  status: string;
  propertyCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminPropertySummary = {
  id: number;
  organizationId: number;
  name: string;
  brand: string | null;
  address: string;
  phoneNumber: string;
  timezone: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrganizationModule = {
  moduleKey: string;
  enabled: boolean;
};

export type AdminOnboardingStatus = {
  organizationCreated: boolean;
  propertyCreated: boolean;
  gmInvited: boolean;
  gmAccepted: boolean;
  hotelConfigured: boolean;
};

export type AdminOrganizationLifecycle = {
  canSuspend: boolean;
  canReactivate: boolean;
  canDeleteTestOrganization: boolean;
  deleteBlockers: string[];
};

export type AdminOrganizationDetail = AdminOrganizationSummary & {
  properties: AdminPropertySummary[];
  modules: AdminOrganizationModule[];
  onboarding: AdminOnboardingStatus;
  onboardingLabel: string;
  pendingInvitations: number;
  lifecycle: AdminOrganizationLifecycle;
};

export type AdminPropertyDetail = AdminPropertySummary & {
  organizationName: string | null;
  organizationSlug?: string | null;
  organizationStatus?: string | null;
  onboarding?: AdminOnboardingStatus;
  onboardingLabel?: string;
  areaCount?: number;
};

export type AdminDashboardResponse = {
  organizationCount: number;
  propertyCount: number;
  activeOrganizationCount: number;
  organizations: AdminOrganizationSummary[];
};

export type CreateOrganizationRequest = {
  name: string;
  slug?: string;
};

export type CreatePropertyRequest = {
  name: string;
  brand?: string | null;
  address?: string;
  phoneNumber?: string;
  timezone?: string;
};

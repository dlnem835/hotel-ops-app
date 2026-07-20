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
  administratorInvited: boolean;
  administratorAccepted: boolean;
  hotelConfigured: boolean;
};

export type AdminOrganizationInvitation = {
  id: string;
  organizationId: number;
  propertyId: number;
  propertyName: string | null;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  status: string;
  isPrimary: boolean;
  orgRole: string;
  propertyRole: string;
  roleLabel: string;
  scopeLabel: string;
  /** Active property assignments for accepted admins (home for pending). */
  assignedPropertyIds: number[];
  /** Module permissions for accepted admins; null when not yet accepted. */
  modulePermissions: Record<string, boolean> | null;
  /** Membership active flag for accepted admins; null when not yet accepted. */
  active: boolean | null;
  authUserId: string | null;
  /** Login username from user_profiles / team_members; null until first-login setup. */
  username: string | null;
  expiresAt: string | null;
  createdAt: string;
  acceptedAt: string | null;
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
  invitations: AdminOrganizationInvitation[];
  canInviteAdministrator: boolean;
};

export type AdminPropertyDetail = AdminPropertySummary & {
  organizationName: string | null;
  organizationSlug?: string | null;
  organizationStatus?: string | null;
  onboarding?: AdminOnboardingStatus;
  onboardingLabel?: string;
  areaCount?: number;
  /** Property-scoped administrators only (not org-wide). */
  invitations?: AdminOrganizationInvitation[];
  modules?: AdminOrganizationModule[];
  canInviteAdministrator?: boolean;
};

export type TransferOwnershipSuccessor = {
  invitationId: string;
  authUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string | null;
  roleLabel: string;
  jobTitle: string;
  status: string;
};

export const TRANSFER_OWNERSHIP_CONFIRM_PHRASE = "TRANSFER OWNERSHIP";

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

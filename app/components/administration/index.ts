/**
 * Neutral administration components shared by the internal Platform Admin
 * portal (/admin) and the customer Organization Administration portal
 * (/settings/organization).
 *
 * These components are portal-agnostic: they read their API namespace and
 * capability set from `AdministrationApiProvider` (see administration-context).
 * Default context = Platform Admin behavior, so importing them from /admin is
 * unchanged. The customer portal wraps them in a provider pointed at
 * `/api/org-admin` with the Organization Admin capability set.
 *
 * Source currently lives under app/admin/components to avoid a high-risk mass
 * file move; this barrel is the stable neutral import path for reuse.
 */

export {
  AdministrationApiProvider,
  useAdministrationApi,
  PLATFORM_OWNER_CAPABILITIES,
  ORGANIZATION_ADMIN_CAPABILITIES,
  NO_ADMINISTRATION_CAPABILITIES,
  type AdministrationCapabilities,
  type AdministrationApiValue,
} from "./administration-context";

export { default as AdminAdministratorsTable } from "@/app/admin/components/AdminAdministratorsTable";
export { default as AdminInviteLeaderModal } from "@/app/admin/components/AdminInviteLeaderModal";
export { default as AdminInviteAdministratorForm } from "@/app/admin/components/AdminInviteAdministratorForm";
export { default as AdminEditAdministratorModal } from "@/app/admin/components/AdminEditAdministratorModal";
export { default as AdminEditOrganizationModal } from "@/app/admin/components/AdminEditOrganizationModal";
export { default as AdminTransferOwnershipModal } from "@/app/admin/components/AdminTransferOwnershipModal";
export { default as AdminChangeEmailModal } from "@/app/admin/components/AdminChangeEmailModal";
export { default as AdminConfirmNameModal } from "@/app/admin/components/AdminConfirmNameModal";
export { default as AdminModalFrame } from "@/app/admin/components/AdminModalFrame";
export { default as AdminPropertyMultiSelect } from "@/app/admin/components/AdminPropertyMultiSelect";
export { default as AdminTimezoneSelect } from "@/app/admin/components/AdminTimezoneSelect";
export { default as AdminStatusBadge } from "@/app/admin/components/AdminStatusBadge";
export { default as AdminErrorState } from "@/app/admin/components/AdminErrorState";
export { default as AdminLoadingState } from "@/app/admin/components/AdminLoadingState";

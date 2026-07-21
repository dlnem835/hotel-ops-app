import type {
  AdministratorActionCapabilities,
  AdministratorInvitationAction,
} from "@/app/lib/platform-admin/server/manage-administrator-invitation";

/**
 * Customer Organization Admin capabilities for invitation management.
 *
 * Philosophy: customers manage their own people, not the platform.
 *   ✓ remove access (history preserved)
 *   ✓ change contact/login email
 *   ✗ transfer Primary Ownership   (platform support only, for now)
 *   ✗ permanently delete Auth user (platform only)
 *   ✗ dismiss revoked invitation   (platform only)
 */
export const ORGANIZATION_ADMIN_ACTION_CAPABILITIES: AdministratorActionCapabilities =
  {
    canRemove: true,
    canChangeEmail: true,
    canTransferOwnership: false,
    canPermanentlyDeleteAuth: false,
    canDismissRevoked: false,
  };

/**
 * Invitation actions a customer Organization Admin may invoke. Actions outside
 * this set are rejected by the route before reaching the shared server function.
 */
export const ORGANIZATION_ADMIN_INVITATION_ACTIONS: readonly AdministratorInvitationAction[] =
  [
    "resend",
    "cancel",
    "disable",
    "enable",
    "remove",
    "send_password_reset",
    "change_email",
  ] as const;

export function isOrganizationAdminInvitationAction(
  action: string
): action is AdministratorInvitationAction {
  return (ORGANIZATION_ADMIN_INVITATION_ACTIONS as readonly string[]).includes(
    action
  );
}

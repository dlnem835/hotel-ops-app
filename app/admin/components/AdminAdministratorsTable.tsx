"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import {
  NO_ADMINISTRATION_CAPABILITIES,
  useAdministrationApi,
  type AdministrationCapabilities,
} from "@/app/components/administration/administration-context";
import type {
  AdminOrganizationInvitation,
  AdminOrganizationModule,
  AdminPropertySummary,
  PlatformAdminMeResponse,
} from "@/app/lib/platform-admin/types";
import type { AdministratorInvitationAction } from "@/app/lib/platform-admin/server/manage-administrator-invitation";
import {
  administratorPropertiesDisplay,
  administratorPropertyFieldLabel,
  isOrgWideRole,
} from "@/app/lib/platform-admin/roles";
import AdminStatusBadge from "./AdminStatusBadge";
import AdminConfirmNameModal from "./AdminConfirmNameModal";
import AdminEditAdministratorModal from "./AdminEditAdministratorModal";
import AdminChangeEmailModal from "./AdminChangeEmailModal";
import AdminTransferOwnershipModal from "./AdminTransferOwnershipModal";

type AdminAdministratorsTableProps = {
  organizationId: number;
  organizationName: string;
  invitations: AdminOrganizationInvitation[];
  properties: AdminPropertySummary[];
  modules: AdminOrganizationModule[];
  onChanged: () => void;
  onError: (message: string) => void;
  onSuccess?: (
    message: string,
    details?: { invitationId: string; email: string }
  ) => void;
  emptyLabel?: string;
  /** Optional empty-state UI (e.g. message + Add button). */
  emptyContent?: ReactNode;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Derives the display status, accounting for disabled (accepted + inactive). */
function displayStatus(invitation: AdminOrganizationInvitation): string {
  if (invitation.status === "accepted" && invitation.active === false) {
    return "disabled";
  }
  return invitation.status;
}

function administratorFullName(invitation: AdminOrganizationInvitation): string {
  return `${invitation.firstName} ${invitation.lastName}`.trim();
}

export default function AdminAdministratorsTable({
  organizationId,
  organizationName,
  invitations,
  properties,
  modules,
  onChanged,
  onError,
  onSuccess,
  emptyLabel = "No administrators yet.",
  emptyContent,
}: AdminAdministratorsTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminOrganizationInvitation | null>(null);
  const [deleteAuthTarget, setDeleteAuthTarget] =
    useState<AdminOrganizationInvitation | null>(null);
  const [dismissTarget, setDismissTarget] =
    useState<AdminOrganizationInvitation | null>(null);
  const [editTarget, setEditTarget] = useState<AdminOrganizationInvitation | null>(null);
  const [changeEmailTarget, setChangeEmailTarget] =
    useState<AdminOrganizationInvitation | null>(null);
  const [transferTarget, setTransferTarget] =
    useState<AdminOrganizationInvitation | null>(null);
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);
  const [changeEmailSubmitting, setChangeEmailSubmitting] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const { basePath, capabilities: injectedCapabilities } = useAdministrationApi();
  const [derivedCapabilities, setDerivedCapabilities] =
    useState<AdministrationCapabilities>(NO_ADMINISTRATION_CAPABILITIES);
  const capabilities = injectedCapabilities ?? derivedCapabilities;
  const [openMoreMenuId, setOpenMoreMenuId] = useState<string | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // When capabilities are supplied by the portal (e.g. Organization Admin),
    // trust them and skip the platform-only /api/admin/me probe.
    if (injectedCapabilities) return;

    let mounted = true;

    async function loadAdminRole() {
      const response = await adminFetch("/api/admin/me");
      if (!mounted || !response.ok) return;
      const body = (await response.json()) as PlatformAdminMeResponse;
      const owner = body.role === "platform_owner";
      // Platform default: Platform Owner unlocks every privileged action;
      // other platform admins keep the reduced set (edit / reset / disable).
      setDerivedCapabilities({
        canRemove: owner,
        canChangeEmail: owner,
        canTransferOwnership: owner,
        canPermanentlyDeleteAuth: owner,
        canDismissRevoked: owner,
        canEditLegalIdentity: owner,
        // Any Platform Admin (owner or not) may manage the entitlement checkbox.
        canManageOrgAdminEntitlement: true,
      });
    }

    void loadAdminRole();
    return () => {
      mounted = false;
    };
  }, [injectedCapabilities]);

  useEffect(() => {
    if (!openMoreMenuId) return;

    function handlePointerDown(event: MouseEvent) {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setOpenMoreMenuId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMoreMenuId(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMoreMenuId]);

  if (invitations.length === 0) {
    if (emptyContent) {
      return <>{emptyContent}</>;
    }
    return <p className="admin-portal__muted">{emptyLabel}</p>;
  }

  async function runAction(
    invitation: AdminOrganizationInvitation,
    action: AdministratorInvitationAction,
    bodyExtras?: Record<string, string>
  ) {
    setBusyId(invitation.id);
    onError("");

    const response = await adminFetch(
      `${basePath}/organizations/${organizationId}/invitations/${invitation.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...bodyExtras }),
      }
    );

    setBusyId(null);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      onError(body?.error ?? `Action failed (${response.status})`);
      return;
    }

    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    const fallbackMessages: Partial<Record<AdministratorInvitationAction, string>> = {
      resend: "Invitation resent successfully.",
      cancel: "Invitation cancelled successfully.",
      disable: "Administrator disabled successfully.",
      enable: "Administrator enabled successfully.",
      remove: "Administrator removed successfully.",
      send_password_reset: "Password reset email sent successfully.",
      permanently_delete_auth_account: "Authentication account deleted successfully.",
      dismiss_revoked_invitation: "Revoked invitation dismissed successfully.",
    };
    onSuccess?.(body?.message ?? fallbackMessages[action] ?? "Action completed successfully.");

    onChanged();
  }

  const propertyNames = (invitation: AdminOrganizationInvitation) => {
    if (isOrgWideRole(invitation.orgRole)) {
      return [];
    }
    return invitation.assignedPropertyIds.map(
      (id) =>
        properties.find((property) => property.id === id)?.name ??
        (id === invitation.propertyId
          ? invitation.propertyName
          : null) ??
        `Property #${id}`
    );
  };

  function affectedPropertiesLabel(invitation: AdminOrganizationInvitation): string {
    if (isOrgWideRole(invitation.orgRole) || invitation.orgRole === "org_owner") {
      if (properties.length === 0) return "All organization properties";
      return properties.map((property) => property.name).join(", ");
    }
    const names = propertyNames(invitation);
    return names.length > 0 ? names.join(", ") : "Assigned properties";
  }

  function renderMoreActions(
    invitation: AdminOrganizationInvitation,
    busy: boolean,
    isDisabled: boolean
  ) {
    const menuOpen = openMoreMenuId === invitation.id;

    return (
      <div
        className="admin-portal__more-actions"
        ref={menuOpen ? moreMenuRef : undefined}
      >
        <button
          type="button"
          className="admin-portal__button admin-portal__button--compact"
          disabled={busy}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() =>
            setOpenMoreMenuId((current) =>
              current === invitation.id ? null : invitation.id
            )
          }
        >
          More actions
        </button>
        {menuOpen ? (
          <div className="admin-portal__more-actions-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="admin-portal__more-actions-item"
              disabled={busy}
              onClick={() => {
                setOpenMoreMenuId(null);
                void runAction(invitation, isDisabled ? "enable" : "disable");
              }}
            >
              {isDisabled ? "Enable" : "Disable"}
            </button>
            {capabilities.canRemove ? (
              <button
                type="button"
                role="menuitem"
                className="admin-portal__more-actions-item admin-portal__more-actions-item--danger"
                disabled={busy}
                onClick={() => {
                  setOpenMoreMenuId(null);
                  setConfirmValue("");
                  setRemoveTarget(invitation);
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function renderAcceptedActions(invitation: AdminOrganizationInvitation, busy: boolean) {
    const isDisabled = invitation.active === false;
    const isPrimary = invitation.isPrimary;

    return (
      <div className="admin-portal__row-actions">
        <button
          type="button"
          className="admin-portal__button admin-portal__button--compact"
          disabled={busy}
          onClick={() => setEditTarget(invitation)}
        >
          Edit
        </button>
        <button
          type="button"
          className="admin-portal__button admin-portal__button--compact"
          disabled={busy}
          onClick={() => void runAction(invitation, "send_password_reset")}
        >
          Send Password Reset
        </button>
        {capabilities.canChangeEmail ? (
          <button
            type="button"
            className="admin-portal__button admin-portal__button--compact"
            disabled={busy}
            onClick={() => {
              setChangeEmailError(null);
              setChangeEmailTarget(invitation);
            }}
          >
            Change Email
          </button>
        ) : null}
        {isPrimary ? (
          capabilities.canTransferOwnership ? (
            <div
              className="admin-portal__more-actions"
              ref={
                openMoreMenuId === invitation.id ? moreMenuRef : undefined
              }
            >
              <button
                type="button"
                className="admin-portal__button admin-portal__button--compact"
                disabled={busy}
                aria-expanded={openMoreMenuId === invitation.id}
                aria-haspopup="menu"
                onClick={() =>
                  setOpenMoreMenuId((current) =>
                    current === invitation.id ? null : invitation.id
                  )
                }
              >
                More actions
              </button>
              {openMoreMenuId === invitation.id ? (
                <div className="admin-portal__more-actions-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-portal__more-actions-item"
                    disabled={busy}
                    onClick={() => {
                      setOpenMoreMenuId(null);
                      setTransferTarget(invitation);
                    }}
                  >
                    Transfer Primary Ownership
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <span className="admin-portal__muted admin-portal__row-actions-note">
              Transfer ownership required to remove
            </span>
          )
        ) : (
          renderMoreActions(invitation, busy, isDisabled)
        )}
      </div>
    );
  }

  function renderActions(invitation: AdminOrganizationInvitation) {
    const busy = busyId === invitation.id;
    const status = invitation.status;

    if (status === "pending" || status === "expired") {
      return (
        <div className="admin-portal__row-actions">
          <button
            type="button"
            className="admin-portal__button admin-portal__button--compact"
            disabled={busy}
            onClick={() => void runAction(invitation, "resend")}
          >
            Resend Invite
          </button>
          <button
            type="button"
            className="admin-portal__button admin-portal__button--compact"
            onClick={() => void runAction(invitation, "cancel")}
            disabled={busy}
          >
            Cancel Invite
          </button>
          {capabilities.canChangeEmail ? (
            <button
              type="button"
              className="admin-portal__button admin-portal__button--compact"
              disabled={busy}
              onClick={() => {
              setChangeEmailError(null);
              setChangeEmailTarget(invitation);
            }}
            >
              Change Email
            </button>
          ) : null}
        </div>
      );
    }

    if (status === "accepted") {
      return renderAcceptedActions(invitation, busy);
    }

    if (
      status === "revoked" &&
      (capabilities.canDismissRevoked || capabilities.canPermanentlyDeleteAuth) &&
      invitation.authUserId &&
      !invitation.isPrimary
    ) {
      return (
        <div className="admin-portal__row-actions">
          <div
            className="admin-portal__more-actions"
            ref={
              openMoreMenuId === invitation.id ? moreMenuRef : undefined
            }
          >
            <button
              type="button"
              className="admin-portal__button admin-portal__button--compact"
              disabled={busy}
              aria-expanded={openMoreMenuId === invitation.id}
              aria-haspopup="menu"
              onClick={() =>
                setOpenMoreMenuId((current) =>
                  current === invitation.id ? null : invitation.id
                )
              }
            >
              More actions
            </button>
            {openMoreMenuId === invitation.id ? (
              <div className="admin-portal__more-actions-menu" role="menu">
                {capabilities.canDismissRevoked ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-portal__more-actions-item"
                    disabled={busy}
                    onClick={() => {
                      setOpenMoreMenuId(null);
                      setConfirmValue("");
                      setDismissTarget(invitation);
                    }}
                  >
                    Dismiss revoked invitation
                  </button>
                ) : null}
                {capabilities.canPermanentlyDeleteAuth ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-portal__more-actions-item admin-portal__more-actions-item--danger"
                    disabled={busy}
                    onClick={() => {
                      setOpenMoreMenuId(null);
                      setConfirmValue("");
                      setDeleteAuthTarget(invitation);
                    }}
                  >
                    Permanently Delete Test Account
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return <span className="admin-portal__muted">—</span>;
  }

  const removeConfirmName = removeTarget ? administratorFullName(removeTarget) : "";
  const deleteAuthConfirmEmail = deleteAuthTarget
    ? deleteAuthTarget.email.trim().toLowerCase()
    : "";
  const dismissConfirmEmail = dismissTarget
    ? dismissTarget.email.trim().toLowerCase()
    : "";

  return (
    <>
      <div className="admin-portal__admin-cards">
        {invitations.map((invitation) => (
          <article key={invitation.id} className="admin-portal__admin-card">
            <div className="admin-portal__admin-card-head">
              <div className="admin-portal__admin-card-identity">
                <span className="admin-portal__admin-card-name">
                  {invitation.firstName} {invitation.lastName}
                </span>
                <span className="admin-portal__admin-card-role">
                  {invitation.jobTitle?.trim() || "Team member"}
                </span>
              </div>
              <AdminStatusBadge status={displayStatus(invitation)} />
            </div>

            <dl className="admin-portal__admin-card-grid">
              <div className="admin-portal__admin-card-field">
                <dt>Email</dt>
                <dd className="admin-portal__admin-card-email">{invitation.email}</dd>
              </div>
              <div className="admin-portal__admin-card-field">
                <dt>Username</dt>
                <dd>
                  {invitation.username?.trim()
                    ? invitation.username
                    : "Not yet created — account setup incomplete"}
                </dd>
              </div>
              <div className="admin-portal__admin-card-field">
                <dt>Job title</dt>
                <dd>{invitation.jobTitle?.trim() || "—"}</dd>
              </div>
              {capabilities.canManageOrgAdminEntitlement ? (
                <div className="admin-portal__admin-card-field">
                  <dt>Admin Portal</dt>
                  <dd>{invitation.orgAdminPortalAccess ? "Yes" : "No"}</dd>
                </div>
              ) : null}
              <div className="admin-portal__admin-card-field">
                <dt>Access Scope</dt>
                <dd>{invitation.scopeLabel}</dd>
              </div>
              <div className="admin-portal__admin-card-field">
                <dt>{administratorPropertyFieldLabel(invitation.orgRole)}</dt>
                <dd>
                  {administratorPropertiesDisplay({
                    orgRole: invitation.orgRole,
                    propertyNames: propertyNames(invitation),
                  })}
                </dd>
              </div>
              <div className="admin-portal__admin-card-field">
                <dt>Sent</dt>
                <dd>{formatDate(invitation.createdAt)}</dd>
              </div>
              <div className="admin-portal__admin-card-field">
                <dt>Accepted</dt>
                <dd>{formatDate(invitation.acceptedAt)}</dd>
              </div>
            </dl>

            <div className="admin-portal__admin-card-actions">
              <span className="admin-portal__admin-card-actions-label">Actions</span>
              {renderActions(invitation)}
            </div>
          </article>
        ))}
      </div>

      <AdminEditAdministratorModal
        open={editTarget !== null}
        organizationId={organizationId}
        invitation={editTarget}
        properties={properties}
        modules={modules}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null);
          onSuccess?.("Administrator saved successfully.");
          onChanged();
        }}
        onError={(message) => {
          onError(message);
        }}
      />

      <AdminChangeEmailModal
        open={changeEmailTarget !== null}
        invitation={changeEmailTarget}
        submitting={changeEmailSubmitting}
        error={changeEmailError}
        onCancel={() => {
          if (changeEmailSubmitting) return;
          setChangeEmailError(null);
          setChangeEmailTarget(null);
        }}
        onConfirm={(newEmail) => {
          if (!changeEmailTarget || changeEmailSubmitting) return;
          const target = changeEmailTarget;
          const requestUrl = `${basePath}/organizations/${organizationId}/invitations/${target.id}`;

          void (async () => {
            setChangeEmailSubmitting(true);
            setChangeEmailError(null);
            onError("");

            try {
              const response = await adminFetch(requestUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "change_email",
                  newEmail,
                }),
              });

              const body = (await response.json().catch(() => null)) as {
                success?: boolean;
                email?: string | null;
                message?: string | null;
                error?: string;
                invitation?: AdminOrganizationInvitation | null;
              } | null;

              console.info("[platform-admin] change_email client response", {
                url: requestUrl,
                status: response.status,
                success: body?.success ?? false,
                emailDomain:
                  body?.email && body.email.includes("@")
                    ? body.email.split("@")[1]
                    : null,
              });

              if (!response.ok || body?.success === false) {
                const message =
                  body?.error ?? `Action failed (${response.status})`;
                setChangeEmailError(message);
                onError(message);
                return;
              }

              const updatedEmail = (body?.email ?? newEmail).trim().toLowerCase();
              const successMessage =
                body?.message ??
                "Email updated. Future invitations and password resets will be sent to the new address.";

              setChangeEmailTarget(null);
              setChangeEmailError(null);
              onSuccess?.(successMessage, {
                invitationId: target.id,
                email: updatedEmail,
              });
              onChanged();
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "Unexpected error while changing email";
              setChangeEmailError(message);
              onError(message);
            } finally {
              setChangeEmailSubmitting(false);
            }
          })();
        }}
      />

      <AdminConfirmNameModal
        open={removeTarget !== null}
        title="Remove administrator"
        description={
          removeTarget
            ? `Permanently revoke ${administratorFullName(removeTarget)}'s access to this organization and its properties.`
            : ""
        }
        organizationName={removeConfirmName}
        confirmLabel="Remove administrator"
        confirmPromptLabel={
          removeTarget
            ? `Type ${removeConfirmName} to confirm`
            : "Type the administrator name to confirm"
        }
        details={
          removeTarget
            ? [
                {
                  label: "Administrator",
                  value: administratorFullName(removeTarget),
                },
                {
                  label: "Organization",
                  value: organizationName,
                },
                {
                  label: "Affected properties",
                  value: affectedPropertiesLabel(removeTarget),
                },
              ]
            : undefined
        }
        warningNote="Removal revokes access immediately but preserves historical activity (pass-ons, work orders, inspections, and reports). The Auth account is not deleted."
        submitting={busyId === removeTarget?.id}
        confirmName={confirmValue}
        onConfirmNameChange={setConfirmValue}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            const target = removeTarget;
            const confirmName = confirmValue.trim();
            setRemoveTarget(null);
            void runAction(target, "remove", { confirmName });
          }
        }}
      />

      <AdminConfirmNameModal
        open={deleteAuthTarget !== null}
        title="Permanently Delete Test Account"
        description={
          deleteAuthTarget
            ? `Delete the Supabase Auth account for ${administratorFullName(deleteAuthTarget)} so this email can be invited again.`
            : ""
        }
        organizationName={deleteAuthConfirmEmail}
        confirmLabel="Permanently Delete Account"
        confirmPromptLabel={
          deleteAuthTarget
            ? `Type ${deleteAuthConfirmEmail} to confirm`
            : "Type the administrator email to confirm"
        }
        details={
          deleteAuthTarget
            ? [
                {
                  label: "Name",
                  value: administratorFullName(deleteAuthTarget),
                },
                {
                  label: "Email",
                  value: deleteAuthTarget.email,
                },
                {
                  label: "Former role",
                  value: deleteAuthTarget.roleLabel,
                },
                {
                  label: "Organization",
                  value: organizationName,
                },
                {
                  label: "Former properties",
                  value: affectedPropertiesLabel(deleteAuthTarget),
                },
              ]
            : undefined
        }
        warningNote="This deletes the Supabase authentication account and allows this email address to be invited again. Operational history will remain preserved."
        submitting={busyId === deleteAuthTarget?.id}
        confirmName={confirmValue}
        onConfirmNameChange={setConfirmValue}
        onCancel={() => setDeleteAuthTarget(null)}
        onConfirm={() => {
          if (deleteAuthTarget) {
            const target = deleteAuthTarget;
            const confirmEmail = confirmValue.trim();
            setDeleteAuthTarget(null);
            void runAction(target, "permanently_delete_auth_account", {
              confirmEmail,
            });
          }
        }}
      />

      <AdminConfirmNameModal
        open={dismissTarget !== null}
        title="Dismiss revoked invitation"
        description={
          dismissTarget
            ? `Hide the revoked invitation for ${administratorFullName(dismissTarget)} from this organization. The Auth account is not deleted — use this when the same email is still an administrator in another organization.`
            : ""
        }
        organizationName={dismissConfirmEmail}
        confirmLabel="Dismiss invitation"
        confirmPromptLabel={
          dismissTarget
            ? `Type ${dismissConfirmEmail} to confirm`
            : "Type the administrator email to confirm"
        }
        details={
          dismissTarget
            ? [
                {
                  label: "Name",
                  value: administratorFullName(dismissTarget),
                },
                {
                  label: "Email",
                  value: dismissTarget.email,
                },
                {
                  label: "Organization",
                  value: organizationName,
                },
              ]
            : undefined
        }
        warningNote="This only removes the revoked card from this organization. Login for other organizations is unchanged."
        submitting={busyId === dismissTarget?.id}
        confirmName={confirmValue}
        onConfirmNameChange={setConfirmValue}
        onCancel={() => setDismissTarget(null)}
        onConfirm={() => {
          if (dismissTarget) {
            const target = dismissTarget;
            const confirmEmail = confirmValue.trim();
            setDismissTarget(null);
            void runAction(target, "dismiss_revoked_invitation", {
              confirmEmail,
            });
          }
        }}
      />

      <AdminTransferOwnershipModal
        open={transferTarget !== null}
        organizationId={organizationId}
        primaryInvitation={transferTarget}
        onClose={() => {
          if (busyId) return;
          setTransferTarget(null);
        }}
        onError={onError}
        onTransferred={(message) => {
          setTransferTarget(null);
          onSuccess?.(message);
          onChanged();
        }}
      />
    </>
  );
}

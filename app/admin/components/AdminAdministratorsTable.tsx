"use client";

import { useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type { AdminOrganizationInvitation } from "@/app/lib/platform-admin/types";
import type { AdministratorInvitationAction } from "@/app/lib/platform-admin/server/manage-administrator-invitation";
import AdminStatusBadge from "./AdminStatusBadge";
import AdminConfirmNameModal from "./AdminConfirmNameModal";

type AdminAdministratorsTableProps = {
  organizationId: number;
  invitations: AdminOrganizationInvitation[];
  onChanged: () => void;
  onError: (message: string) => void;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** Derives the display status, accounting for disabled (accepted + inactive). */
function displayStatus(invitation: AdminOrganizationInvitation): string {
  if (invitation.status === "accepted" && invitation.active === false) {
    return "disabled";
  }
  return invitation.status;
}

export default function AdminAdministratorsTable({
  organizationId,
  invitations,
  onChanged,
  onError,
}: AdminAdministratorsTableProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminOrganizationInvitation | null>(null);
  const [confirmValue, setConfirmValue] = useState("");

  if (invitations.length === 0) {
    return <p className="admin-portal__muted">No administrators yet.</p>;
  }

  async function runAction(
    invitation: AdminOrganizationInvitation,
    action: AdministratorInvitationAction
  ) {
    setBusyId(invitation.id);
    onError("");

    const response = await adminFetch(
      `/api/admin/organizations/${organizationId}/invitations/${invitation.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }
    );

    setBusyId(null);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      onError(body?.error ?? `Action failed (${response.status})`);
      return;
    }

    onChanged();
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
          onClick={() => void runAction(invitation, "send_password_reset")}
        >
          Send Password Reset
        </button>
        {isPrimary ? (
          <span className="admin-portal__muted admin-portal__row-actions-note">
            Protected
          </span>
        ) : (
          <>
            <button
              type="button"
              className="admin-portal__button admin-portal__button--compact"
              disabled={busy}
              onClick={() => void runAction(invitation, isDisabled ? "enable" : "disable")}
            >
              {isDisabled ? "Enable" : "Disable"}
            </button>
            <button
              type="button"
              className="admin-portal__button admin-portal__button--compact admin-portal__button--danger"
              disabled={busy}
              onClick={() => {
                setConfirmValue("");
                setRemoveTarget(invitation);
              }}
            >
              Remove
            </button>
          </>
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
            disabled={busy}
            onClick={() => void runAction(invitation, "cancel")}
          >
            Cancel
          </button>
        </div>
      );
    }

    if (status === "accepted") {
      return renderAcceptedActions(invitation, busy);
    }

    return <span className="admin-portal__muted">—</span>;
  }

  return (
    <>
      <div className="admin-portal__table-wrap admin-portal__table-wrap--administrators">
        <table className="admin-portal__table admin-portal__table--administrators">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Scope</th>
              <th>Property</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Accepted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => (
              <tr key={invitation.id}>
                <td className="admin-portal__cell--name">
                  {invitation.firstName} {invitation.lastName}
                </td>
                <td className="admin-portal__cell--email">{invitation.email}</td>
                <td className="admin-portal__cell--role">{invitation.roleLabel}</td>
                <td className="admin-portal__cell--scope">{invitation.scopeLabel}</td>
                <td className="admin-portal__cell--property">
                  {invitation.propertyName ?? `Property #${invitation.propertyId}`}
                </td>
                <td className="admin-portal__cell--status">
                  <AdminStatusBadge status={displayStatus(invitation)} />
                </td>
                <td className="admin-portal__cell--date">{formatDate(invitation.createdAt)}</td>
                <td className="admin-portal__cell--date">{formatDate(invitation.acceptedAt)}</td>
                <td className="admin-portal__cell--actions">{renderActions(invitation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminConfirmNameModal
        open={removeTarget !== null}
        title="Remove administrator"
        description={
          removeTarget
            ? `This revokes ${removeTarget.firstName} ${removeTarget.lastName}'s access to this organization. Type their email to confirm.`
            : ""
        }
        organizationName={removeTarget?.email ?? ""}
        confirmLabel="Remove administrator"
        submitting={busyId === removeTarget?.id}
        confirmName={confirmValue}
        onConfirmNameChange={setConfirmValue}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            const target = removeTarget;
            setRemoveTarget(null);
            void runAction(target, "remove");
          }
        }}
      />
    </>
  );
}

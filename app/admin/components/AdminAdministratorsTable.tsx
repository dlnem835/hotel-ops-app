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
            Cancel Invite
          </button>
        </div>
      );
    }

    if (status === "accepted") {
      return renderAcceptedActions(invitation, busy);
    }

    return <span className="admin-portal__muted">—</span>;
  }

  const propertyName = (invitation: AdminOrganizationInvitation) =>
    invitation.propertyName ?? `Property #${invitation.propertyId}`;

  return (
    <>
      {/* Wide layout: table (hidden on narrow screens via CSS). */}
      <div className="admin-portal__table-wrap admin-portal__table-wrap--administrators">
        <table className="admin-portal__table admin-portal__table--administrators">
          <thead>
            <tr>
              <th className="admin-portal__cell--name">Administrator</th>
              <th className="admin-portal__cell--email">Email</th>
              <th className="admin-portal__cell--role">Role &amp; scope</th>
              <th className="admin-portal__cell--property">Property</th>
              <th className="admin-portal__cell--status">Status</th>
              <th className="admin-portal__cell--date">Dates</th>
              <th className="admin-portal__cell--actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => (
              <tr key={invitation.id}>
                <td className="admin-portal__cell--name">
                  {invitation.firstName} {invitation.lastName}
                </td>
                <td className="admin-portal__cell--email">{invitation.email}</td>
                <td className="admin-portal__cell--role">
                  <span className="admin-portal__cell-primary">{invitation.roleLabel}</span>
                  <span className="admin-portal__cell-sub">{invitation.scopeLabel}</span>
                </td>
                <td className="admin-portal__cell--property">{propertyName(invitation)}</td>
                <td className="admin-portal__cell--status">
                  <AdminStatusBadge status={displayStatus(invitation)} />
                </td>
                <td className="admin-portal__cell--date">
                  <span className="admin-portal__cell-sub">
                    Sent: {formatDate(invitation.createdAt)}
                  </span>
                  <span className="admin-portal__cell-sub">
                    Accepted: {formatDate(invitation.acceptedAt)}
                  </span>
                </td>
                <td className="admin-portal__cell--actions">{renderActions(invitation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Narrow layout: stacked cards (hidden on wide screens via CSS). */}
      <div className="admin-portal__admin-cards">
        {invitations.map((invitation) => (
          <article key={invitation.id} className="admin-portal__admin-card">
            <div className="admin-portal__admin-card-head">
              <span className="admin-portal__admin-card-name">
                {invitation.firstName} {invitation.lastName}
              </span>
              <AdminStatusBadge status={displayStatus(invitation)} />
            </div>
            <dl className="admin-portal__admin-card-grid">
              <div className="admin-portal__admin-card-field">
                <dt>Email</dt>
                <dd className="admin-portal__admin-card-email">{invitation.email}</dd>
              </div>
              <div className="admin-portal__admin-card-field">
                <dt>Role</dt>
                <dd>{invitation.roleLabel}</dd>
              </div>
              <div className="admin-portal__admin-card-field">
                <dt>Scope</dt>
                <dd>{invitation.scopeLabel}</dd>
              </div>
              <div className="admin-portal__admin-card-field">
                <dt>Property</dt>
                <dd>{propertyName(invitation)}</dd>
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
              {renderActions(invitation)}
            </div>
          </article>
        ))}
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

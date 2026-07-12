"use client";

import type { AdminOrganizationInvitation } from "@/app/lib/platform-admin/types";
import AdminStatusBadge from "./AdminStatusBadge";

type AdminInvitationsTableProps = {
  invitations: AdminOrganizationInvitation[];
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function AdminInvitationsTable({
  invitations,
}: AdminInvitationsTableProps) {
  if (invitations.length === 0) {
    return <p className="admin-portal__muted">No invitations yet.</p>;
  }

  return (
    <div className="admin-portal__table-wrap">
      <table className="admin-portal__table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Property</th>
            <th>Status</th>
            <th>Sent</th>
            <th>Accepted</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((invitation) => (
            <tr key={invitation.id}>
              <td>
                {invitation.firstName} {invitation.lastName}
              </td>
              <td>{invitation.email}</td>
              <td>{invitation.propertyName ?? `Property #${invitation.propertyId}`}</td>
              <td>
                <AdminStatusBadge status={invitation.status} />
              </td>
              <td>{formatDate(invitation.createdAt)}</td>
              <td>{formatDate(invitation.acceptedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { AdminOrganizationSummary } from "@/app/lib/platform-admin/types";
import AdminStatusBadge from "./AdminStatusBadge";

type AdminOrganizationsTableProps = {
  organizations: AdminOrganizationSummary[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function AdminOrganizationsTable({
  organizations,
}: AdminOrganizationsTableProps) {
  if (organizations.length === 0) {
    return <p className="admin-portal__muted">No organizations yet.</p>;
  }

  return (
    <div className="admin-portal__table-wrap">
      <table className="admin-portal__table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Properties</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((organization) => (
            <tr key={organization.id}>
              <td>
                <Link
                  href={`/admin/organizations/${organization.id}`}
                  className="admin-portal__link"
                >
                  {organization.name}
                </Link>
              </td>
              <td>{organization.slug}</td>
              <td>
                <AdminStatusBadge status={organization.status} />
              </td>
              <td>{organization.propertyCount}</td>
              <td>{formatDate(organization.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

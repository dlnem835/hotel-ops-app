"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import type {
  AdminOrganizationDetail,
  PlatformAdminMeResponse,
} from "@/app/lib/platform-admin/types";
import AdminConfirmNameModal from "./AdminConfirmNameModal";

type AdminOrganizationLifecycleActionsProps = {
  organization: AdminOrganizationDetail;
  onOrganizationUpdated: (organization: AdminOrganizationDetail) => void;
  onError: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export default function AdminOrganizationLifecycleActions({
  organization,
  onOrganizationUpdated,
  onError,
  onSuccess,
}: AdminOrganizationLifecycleActionsProps) {
  const router = useRouter();
  const [adminRole, setAdminRole] = useState<PlatformAdminMeResponse["role"] | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadAdminRole() {
      const response = await adminFetch("/api/admin/me");
      if (!mounted || !response.ok) return;

      const body = (await response.json()) as PlatformAdminMeResponse;
      setAdminRole(body.role);
    }

    void loadAdminRole();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSuspend() {
    const confirmed = window.confirm(
      `Suspend ${organization.name}? Hotel users in this organization will lose API access while suspended.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    onError("");

    const response = await adminFetch(`/api/admin/organizations/${organization.id}/suspend`, {
      method: "POST",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      onError(body?.error ?? `Suspend failed (${response.status})`);
      setActionLoading(false);
      return;
    }

    const updated = (await response.json()) as AdminOrganizationDetail;
    onOrganizationUpdated(updated);
    onSuccess?.("Organization suspended successfully.");
    setActionLoading(false);
  }

  async function handleReactivate() {
    setActionLoading(true);
    onError("");

    const response = await adminFetch(
      `/api/admin/organizations/${organization.id}/reactivate`,
      { method: "POST" }
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      onError(body?.error ?? `Reactivate failed (${response.status})`);
      setActionLoading(false);
      return;
    }

    const updated = (await response.json()) as AdminOrganizationDetail;
    onOrganizationUpdated(updated);
    onSuccess?.("Organization reactivated successfully.");
    setActionLoading(false);
  }

  async function handleDelete() {
    setActionLoading(true);
    onError("");

    const response = await adminFetch(`/api/admin/organizations/${organization.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName: confirmName.trim() }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      onError(body?.error ?? `Delete failed (${response.status})`);
      setActionLoading(false);
      return;
    }

    setDeleteModalOpen(false);
    setConfirmName("");
    router.push("/admin/organizations");
  }

  const showDelete =
    adminRole === "platform_owner" && organization.lifecycle.canDeleteTestOrganization;

  if (
    !organization.lifecycle.canSuspend &&
    !organization.lifecycle.canReactivate &&
    !showDelete
  ) {
    return null;
  }

  return (
    <>
      <section className="admin-portal__card">
        <h3 className="admin-portal__section-title">Lifecycle</h3>
        <div className="admin-portal__form-actions">
          {organization.lifecycle.canSuspend ? (
            <button
              type="button"
              className="admin-portal__button"
              onClick={() => void handleSuspend()}
              disabled={actionLoading}
            >
              Suspend organization
            </button>
          ) : null}
          {organization.lifecycle.canReactivate ? (
            <button
              type="button"
              className="admin-portal__button admin-portal__button--primary"
              onClick={() => void handleReactivate()}
              disabled={actionLoading}
            >
              Reactivate organization
            </button>
          ) : null}
          {showDelete ? (
            <button
              type="button"
              className="admin-portal__button admin-portal__button--danger"
              onClick={() => {
                setConfirmName("");
                setDeleteModalOpen(true);
              }}
              disabled={actionLoading}
            >
              Delete test organization
            </button>
          ) : null}
        </div>
        {organization.lifecycle.deleteBlockers.length > 0 &&
        adminRole === "platform_owner" &&
        !organization.lifecycle.canDeleteTestOrganization ? (
          <p className="admin-portal__muted">
            Permanent deletion is blocked while related data exists:{" "}
            {organization.lifecycle.deleteBlockers.join(", ")}
          </p>
        ) : null}
      </section>

      <AdminConfirmNameModal
        open={deleteModalOpen}
        title="Delete test organization"
        description="This permanently removes an empty test organization. Type the exact organization name to confirm."
        organizationName={organization.name}
        confirmLabel="Delete test organization"
        submitting={actionLoading}
        confirmName={confirmName}
        onConfirmNameChange={setConfirmName}
        onCancel={() => {
          if (!actionLoading) {
            setDeleteModalOpen(false);
            setConfirmName("");
          }
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

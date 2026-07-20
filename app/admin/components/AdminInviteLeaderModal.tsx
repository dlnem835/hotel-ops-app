"use client";

import { useEffect, useState } from "react";
import type {
  AdminOrganizationDetail,
  AdminOrganizationInvitation,
} from "@/app/lib/platform-admin/types";
import AdminInviteAdministratorForm from "./AdminInviteAdministratorForm";
import AdminModalFrame from "./AdminModalFrame";

type AdminInviteLeaderModalProps = {
  open: boolean;
  organization: AdminOrganizationDetail | null;
  scope: "organization" | "property";
  lockedPropertyId?: number;
  onClose: () => void;
  onInvitationCreated: (invitation: AdminOrganizationInvitation) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export default function AdminInviteLeaderModal({
  open,
  organization,
  scope,
  lockedPropertyId,
  onClose,
  onInvitationCreated,
  onSuccess,
  onError,
}: AdminInviteLeaderModalProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
    }
  }, [open]);

  if (!open || !organization) {
    return null;
  }

  const isProperty = scope === "property";
  const title = isProperty
    ? "Add Property Leader"
    : "Add Organization Leader";

  function requestClose() {
    if (submitting) return;
    onClose();
  }

  return (
    <AdminModalFrame
      open={open}
      title={title}
      titleId={
        isProperty
          ? "admin-invite-property-leader-title"
          : "admin-invite-organization-leader-title"
      }
      wide
      lockClose={submitting}
      closeOnBackdrop={!submitting}
      onClose={requestClose}
    >
      <AdminInviteAdministratorForm
        key={`${organization.id}-${scope}-${lockedPropertyId ?? "org"}-${open}`}
        organization={organization}
        scope={scope}
        lockedPropertyId={lockedPropertyId}
        embedded
        onCancel={requestClose}
        onSubmittingChange={setSubmitting}
        onInvitationCreated={(invitation) => {
          onInvitationCreated(invitation);
        }}
        onSuccess={(message) => {
          onSuccess(message);
          onClose();
        }}
        onError={onError}
      />
    </AdminModalFrame>
  );
}
